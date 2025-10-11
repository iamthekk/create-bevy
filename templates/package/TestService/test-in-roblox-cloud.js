#!/usr/bin/env node

/**
 * 本地开发环境测试脚本
 *
 * 自动执行完整的测试流程：
 * 1. TypeScript → Lua 编译
 * 2. Rojo 构建 Place 文件
 * 3. 上传到测试 Place
 * 4. 运行 TestEZ 测试
 * 5. 获取并显示测试结果
 *
 * 测试名称过滤和日志捕获：
 * - 支持通过 pattern 参数过滤测试：node test-in-roblox-cloud.js <pattern>
 * - 当提供 pattern 时，会捕获详细的测试执行日志（测试树结构、状态标记等）
 * - 不提供 pattern 时，仅返回统计数据和错误信息，不捕获日志
 * - 日志捕获通过自定义 Reporter 实现，避免了 Roblox Cloud API 不捕获 print() 的限制
 *
 * 使用示例：
 *   npm test                    # 运行所有测试（不捕获详细日志）
 *   npm test loop               # 只运行包含 "loop" 的测试（捕获详细日志）
 *   npm test "should allow"     # 运行包含 "should allow" 的测试（捕获详细日志）
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

// 加载环境变量
require('dotenv').config({ path: '.env.roblox' }); // 先加载默认配置
require('dotenv').config({ path: '.env' });        // 本地可覆盖

// 配置
const CONFIG = {
  // Roblox API
  apiKey: process.env.ROBLOX_API_KEY,
  universeId: process.env.UNIVERSE_ID,
  testPlaceId: process.env.TEST_PLACE_ID,
  apiBaseUrl: 'apis.roblox.com',

  // 本地路径
  rojoProjectFile: process.env.ROJO_PROJECT_FILE || 'default.project.json',
  buildOutput: process.env.BUILD_OUTPUT || 'test-place.rbxl',

  // 网络代理
  httpProxy: process.env.HTTP_PROXY || process.env.HTTPS_PROXY,

  // 构建选项
  skipBuild: process.argv.includes('--skip-build'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
};

/**
 * 打印带颜色的日志
 */
const log = {
  info: (msg) => console.log(`\x1b[36mℹ\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  error: (msg) => console.error(`\x1b[31m✗\x1b[0m ${msg}`),
  warn: (msg) => console.warn(`\x1b[33m⚠\x1b[0m ${msg}`),
  step: (msg) => console.log(`\n\x1b[1m▶ ${msg}\x1b[0m`),
};

/**
 * 执行命令并返回 Promise
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: CONFIG.verbose ? 'inherit' : 'pipe',
      shell: true,
      ...options,
    });

    let stdout = '';
    let stderr = '';

    if (!CONFIG.verbose) {
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`命令执行失败 (退出码 ${code})\n${stderr || stdout}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * 步骤 1: Rojo 构建 Place
 */
async function buildPlace() {
  if (CONFIG.skipBuild) {
    log.warn('跳过 Rojo 构建 (--skip-build)');
    return;
  }

  log.step('步骤 1/4: Rojo 构建 Place 文件');

  try {
    log.info(`构建文件: ${CONFIG.rojoProjectFile} → ${CONFIG.buildOutput}`);

    await runCommand('rojo', [
      'build',
      CONFIG.rojoProjectFile,
      '-o',
      CONFIG.buildOutput
    ]);

    const stats = fs.statSync(CONFIG.buildOutput);
    log.success(`Place 文件构建完成 (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    log.error(`构建失败: ${error.message}`);
    throw error;
  }
}

/**
 * 步骤 2: 上传到测试 Place
 */
async function uploadPlace() {
  log.step('步骤 2/4: 上传到测试 Place');

  if (!fs.existsSync(CONFIG.buildOutput)) {
    throw new Error(`构建文件不存在: ${CONFIG.buildOutput}`);
  }

  const fileContent = fs.readFileSync(CONFIG.buildOutput);
  const fileSize = fileContent.length;

  log.info(`上传文件: ${CONFIG.buildOutput} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
  log.info(`目标: Place ${CONFIG.testPlaceId}`);

  const apiPath = `/universes/v1/${CONFIG.universeId}/places/${CONFIG.testPlaceId}/versions?versionType=Saved`;

  if (CONFIG.verbose) {
    console.log('\n调试信息:');
    console.log(`  API Host: ${CONFIG.apiBaseUrl}`);
    console.log(`  API Path: ${apiPath}`);
    console.log(`  Universe ID: ${CONFIG.universeId}`);
    console.log(`  Place ID: ${CONFIG.testPlaceId}`);
    console.log(`  API Key 前缀: ${CONFIG.apiKey.substring(0, 20)}...`);
    console.log(`  使用代理: ${CONFIG.httpProxy || '无'}`);
    console.log('');
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.apiBaseUrl,
      port: 443,
      path: apiPath,
      method: 'POST',
      headers: {
        'x-api-key': CONFIG.apiKey,
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileSize,
      },
    };

    // 添加代理支持
    if (CONFIG.httpProxy) {
      options.agent = new HttpsProxyAgent(CONFIG.httpProxy);
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          log.success('Place 文件上传成功');
          try {
            const response = JSON.parse(data);
            if (CONFIG.verbose) {
              console.log('响应:', response);
            }
            resolve(response);
          } catch (e) {
            resolve({ message: 'Upload successful' });
          }
        } else {
          log.error(`上传失败 (${res.statusCode}): ${data}`);
          reject(new Error(`Upload failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      log.error(`请求错误: ${error.message}`);
      reject(error);
    });

    req.write(fileContent);
    req.end();
  });
}

/**
 * 步骤 3: 运行 TestEZ 测试
 */
async function runTests(pattern = null) {
  log.step('步骤 3/4: 运行 TestEZ 测试');

  // 读取测试脚本
  const testScriptPath = path.join(process.cwd(), 'TestService', 'cloud-test.lua');
  let testScript = fs.readFileSync(testScriptPath, 'utf-8');

  // 替换 pattern 占位符
  testScript = testScript.replace('{{TEST_NAME_PATTERN}}', pattern || '');

  log.info('提交测试任务到 Roblox...');

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      script: testScript,
    });

    const options = {
      hostname: CONFIG.apiBaseUrl,
      port: 443,
      path: `/cloud/v2/universes/${CONFIG.universeId}/places/${CONFIG.testPlaceId}/luau-execution-session-tasks`,
      method: 'POST',
      headers: {
        'x-api-key': CONFIG.apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    // 添加代理支持
    if (CONFIG.httpProxy) {
      options.agent = new HttpsProxyAgent(CONFIG.httpProxy);
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          log.success('测试任务已提交');
          try {
            const response = JSON.parse(data);
            if (CONFIG.verbose) {
              console.log('任务响应:', JSON.stringify(response, null, 2));
            }
            resolve(response);
          } catch (e) {
            log.error(`解析响应失败: ${e.message}`);
            log.error(`原始响应: ${data}`);
            reject(e);
          }
        } else {
          log.error(`提交失败 (${res.statusCode}): ${data}`);
          reject(new Error(`Execution failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      log.error(`请求错误: ${error.message}`);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 步骤 4: 获取测试结果
 */
async function getTestResults(taskPath, maxRetries = 30, retryDelay = 2000) {
  log.step('步骤 4/4: 获取测试结果');

  log.info('等待测试执行完成...');

  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, retryDelay));

    const result = await new Promise((resolve, reject) => {
      // 确保路径格式正确
      let apiPath = taskPath.replace(`https://${CONFIG.apiBaseUrl}`, '');

      // API 返回的 path 是相对路径，需要添加 /cloud/v2/ 前缀
      if (!apiPath.startsWith('/cloud/v2/')) {
        if (apiPath.startsWith('/')) {
          apiPath = '/cloud/v2' + apiPath;
        } else {
          apiPath = '/cloud/v2/' + apiPath;
        }
      }

      const options = {
        hostname: CONFIG.apiBaseUrl,
        port: 443,
        path: apiPath,
        method: 'GET',
        headers: {
          'x-api-key': CONFIG.apiKey,
        },
      };

      // 添加代理支持
      if (CONFIG.httpProxy) {
        options.agent = new HttpsProxyAgent(CONFIG.httpProxy);
      }

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          } else {
            console.error(`\n获取结果失败 (${res.statusCode}):`);
            console.error(`响应内容: ${data}`);
            if (CONFIG.verbose) {
              console.error(`请求路径: ${options.path}`);
            }
            reject(new Error(`Failed to get results: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });

    if (result.state === 'COMPLETE') {
      log.success('测试执行完成');
      if (CONFIG.verbose) {
        console.log('\nAPI 返回的完整结果:');
        console.log(JSON.stringify(result, null, 2));
      }
      return result;
    } else if (result.state === 'FAILED') {
      log.error('测试执行失败');
      return result;
    }

    process.stdout.write(`\r⏳ 状态: ${result.state}, 等待中... (${i + 1}/${maxRetries})`);
  }

  throw new Error('获取测试结果超时');
}

/**
 * 解析并显示测试结果
 */
function displayResults(testResults) {
  console.log('\n');
  console.log('═══════════════════════════════════════');
  console.log('           测试结果摘要');
  console.log('═══════════════════════════════════════');

  let parsedResults;
  try {
    if (testResults.output && testResults.output.results) {
      parsedResults = JSON.parse(testResults.output.results);
      parsedResults.important = "这是由 roblox cloud test 执行的单元测试结果! 启动脚本在 `TestService\\cloud-test.lua`. 修复后, 可以运行 `scripts\\test-in-roblox-cloud.js` 进行验证."
    } else {
      parsedResults = {
        important: "这是由 roblox cloud test 执行的单元测试结果! 启动脚本在 `TestService\\cloud-test.lua`. 修复后, 可以运行 `scripts\\test-in-roblox-cloud.js` 进行验证.",
        success: testResults.state === 'COMPLETE',
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        rawOutput: testResults.output,
      };
    }
  } catch (e) {
    parsedResults = {
      important: "这是由 roblox cloud test 执行的单元测试结果! 启动脚本在 `TestService\\cloud-test.lua`. 修复后, 可以运行 `scripts\\test-in-roblox-cloud.js` 进行验证.",
      success: false,
      error: 'Failed to parse results',
      rawOutput: testResults,
    };
  }

  // 保存结果
  const testResultDir = path.join(process.cwd(), '.test-result');
  if (!fs.existsSync(testResultDir)) {
    fs.mkdirSync(testResultDir, { recursive: true });
  }
  const dateString = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const resultsPath = path.join(testResultDir, `${dateString}.json`);
  fs.writeFileSync(resultsPath, JSON.stringify(parsedResults, null, 2));

  // 显示摘要
  const passRate = parsedResults.totalTests > 0
    ? ((parsedResults.passed / parsedResults.totalTests) * 100).toFixed(2)
    : 0;

  console.log(`状态: ${parsedResults.success ? '\x1b[32m✓ 通过\x1b[0m' : '\x1b[31m✗ 失败\x1b[0m'}`);
  console.log(`总计: ${parsedResults.totalTests || 0}`);
  console.log(`通过: \x1b[32m${parsedResults.passed || 0}\x1b[0m`);
  console.log(`失败: \x1b[31m${parsedResults.failed || 0}\x1b[0m`);
  console.log(`跳过: \x1b[33m${parsedResults.skipped || 0}\x1b[0m`);
  console.log(`通过率: ${passRate}%`);
  console.log('═══════════════════════════════════════');

  if (parsedResults.errors && parsedResults.errors.length > 0) {
    console.log('\n\x1b[31m错误详情:\x1b[0m\n');
    parsedResults.errors.forEach((error, index) => {
      console.log(`\x1b[31m错误 ${index + 1}:\x1b[0m`);
      console.log(error.message);
      if (error.trace) {
        console.log('\x1b[90m堆栈跟踪:\x1b[0m');
        console.log(error.trace);
      }
      console.log('');
    });
  }

  // 显示捕获的测试日志
  if (parsedResults.logs && parsedResults.logs.length > 0) {
    console.log('\n\x1b[36m测试执行日志:\x1b[0m\n');
    parsedResults.logs.forEach(log => {
      console.log(log);
    });
  }

  if (parsedResults.rawOutput && CONFIG.verbose) {
    console.log('\n\x1b[90m原始输出:\x1b[0m');
    console.log(JSON.stringify(parsedResults.rawOutput, null, 2));
  }

  console.log(`\n📝 完整结果已保存到: ${resultsPath}\n`);

  return parsedResults;
}

/**
 * 验证环境变量
 */
function validateEnvironment() {
  const required = ['ROBLOX_API_KEY', 'UNIVERSE_ID', 'TEST_PLACE_ID'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    log.error(`缺少必需的环境变量: ${missing.join(', ')}`);
    console.log('\n请检查 .env 文件或设置以下环境变量:');
    missing.forEach(key => {
      console.log(`  - ${key}`);
    });
    console.log('\n参考 .env.example 文件配置');
    process.exit(1);
  }
}

/**
 * 清理旧测试结果，只保留最近的2条记录
 */
function cleanupOldTestResults() {
  const testResultDir = path.join(process.cwd(), '.test-result');

  // 如果目录不存在，则无需清理
  if (!fs.existsSync(testResultDir)) {
    return;
  }

  try {
    // 读取所有 .json 文件
    const files = fs.readdirSync(testResultDir)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(testResultDir, file),
        time: fs.statSync(path.join(testResultDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // 按时间倒序排序

    // 保留最近的2条，删除其余的
    if (files.length > 2) {
      const filesToDelete = files.slice(2);
      log.info(`清理旧测试结果，删除 ${filesToDelete.length} 条记录`);

      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        if (CONFIG.verbose) {
          log.info(`  删除: ${file.name}`);
        }
      }
    }
  } catch (error) {
    log.warn(`清理旧测试结果失败: ${error.message}`);
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
本地开发环境测试脚本

用法:
  node scripts/test-in-roblox-cloud.js [pattern] [选项]

参数:
  pattern           可选的测试名称过滤模式 (匹配包含此字符串的测试)

选项:
  --skip-build      跳过 Rojo 构建
  -v, --verbose     显示详细输出
  -h, --help        显示帮助信息

示例:
  # 完整流程
  node scripts/test-in-roblox-cloud.js

  # 仅上传和测试（假设已有构建文件）
  node scripts/test-in-roblox-cloud.js --skip-build

  # 只运行名称包含 "system" 的测试
  node scripts/test-in-roblox-cloud.js system

  # 运行特定测试并跳过构建
  node scripts/test-in-roblox-cloud.js "schedule test" --skip-build

环境变量:
  ROBLOX_API_KEY       Roblox Open Cloud API Key (必需)
  UNIVERSE_ID          游戏的 Universe ID (必需)
  TEST_PLACE_ID        测试 Place ID (必需)
  ROJO_PROJECT_FILE    Rojo 项目文件 (默认: default.project.json)
  BUILD_OUTPUT         构建输出文件 (默认: test-place.rbxl)
`);
}

/**
 * 主函数
 */
async function main() {
  // 检查帮助参数
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // 解析 pattern 参数 (第一个非选项参数)
  const pattern = process.argv.slice(2).find(arg => !arg.startsWith('--') && arg !== '-v');

  console.log('\x1b[1m\n🚀 本地开发环境测试流程\x1b[0m');
  console.log('═══════════════════════════════════════\n');

  if (pattern) {
    log.info(`测试名称过滤: ${pattern}`);
  }

  const startTime = Date.now();

  try {
    // 验证环境
    validateEnvironment();

    // 清理旧测试结果
    cleanupOldTestResults();

    // 执行测试流程
    await buildPlace();

    // 上传 Place
    await uploadPlace();

    // 运行测试
    const taskResponse = await runTests(pattern);

    if (!taskResponse.path) {
      throw new Error('未获取到任务路径');
    }

    const testResults = await getTestResults(taskResponse.path);
    const parsedResults = displayResults(testResults);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  总耗时: ${duration}秒\n`);

    // 设置退出码
    process.exit(parsedResults.success ? 0 : 1);

  } catch (error) {
    log.error(`执行失败: ${error.message}`);

    if (CONFIG.verbose && error.stack) {
      console.error('\n堆栈跟踪:');
      console.error(error.stack);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  总耗时: ${duration}秒\n`);

    process.exit(1);
  }
}

// 运行主函数
main();
