/**
 * 自动链接 node_modules 包中的插件资源到 .claude/ 目录
 *
 * 功能说明:
 * 1. 扫描指定的 node_modules 子目录（支持 scope，如 @white-dragon-bevy）
 * 2. 查找其中所有子包的 .claude-plugin/ 下的指定目录（agents, skills, commands）
 * 3. 将每个资源子目录链接到 .claude/ 对应目录下
 * 4. 链接名称格式：
 *    - skills: @{scope}__{包名}__{资源名} (避免命名冲突，扫描子目录)
 *    - agents: @{scope}__{包名} (直接链接整个目录)
 *    - commands: @{scope}__{包名} (直接链接整个目录)
 *
 * 使用方法:
 * node scripts/link-skills.js @white-dragon-bevy @another-scope
 * node scripts/link-skills.js --dry-run @white-dragon-bevy
 *
 * 注意:
 * - Windows 系统使用 junction 类型链接，不需要管理员权限
 * - --dry-run 参数仅预览，不实际创建链接
 * - 运行时会先清除 .claude/ 目录下所有以 @ 开头的文件夹
 * - 已存在的同名链接会被覆盖
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 需要处理的插件目录列表（可扩展）
const PLUGIN_DIRS = ['agents', 'skills', 'commands'];

// 显示帮助信息
function showHelp() {
  console.log(`
自动链接 node_modules 包中的插件资源到 .claude/ 目录

用法:
  pnpm run link-skills -- <目录名> [<目录名>...]
  pnpm run link-skills:preview -- <目录名> [<目录名>...]
  node scripts/link-skills.js [选项] <目录名> [<目录名>...]

参数:
  <目录名>          node_modules 下的目录名（可以是 scope 如 @white-dragon-bevy）

选项:
  --help           显示此帮助信息
  --dry-run        预览模式，仅显示将要创建的链接，不实际执行

示例:
  # 预览将要创建的链接
  pnpm run link-skills:preview -- @white-dragon-bevy

  # 实际创建链接
  pnpm run link-skills -- @white-dragon-bevy

  # 处理多个目录
  pnpm run link-skills -- @white-dragon-bevy @another-scope

  # 直接运行脚本
  node scripts/link-skills.js --dry-run @white-dragon-bevy

工作原理:
  1. 清理 .claude/ 目录下所有以 @ 开头的文件夹
  2. 扫描 node_modules/{目录名}/ 下的所有子包
  3. 在每个子包中查找以下目录:
     - .claude-plugin/agents/
     - .claude-plugin/skills/
     - .claude-plugin/commands/
  4. 将资源链接到 .claude/ 对应目录下
  5. 链接命名格式:
     - skills: @{scope}__{包名}__{资源名} (扫描子目录并逐个链接)
     - agents: @{scope}__{包名} (直接链接整个目录)
     - commands: @{scope}__{包名} (直接链接整个目录)

示例路径映射:
  node_modules/@white-dragon-bevy/some-plugin/.claude-plugin/skills/abc
    -> .claude/skills/@white-dragon-bevy__some-plugin__abc

  node_modules/@white-dragon-bevy/some-plugin/.claude-plugin/agents/
    -> .claude/agents/@white-dragon-bevy__some-plugin

  node_modules/@white-dragon-bevy/some-plugin/.claude-plugin/commands/
    -> .claude/commands/@white-dragon-bevy__some-plugin

注意事项:
  • Windows 系统使用 junction 类型链接，不需要管理员权限
  • 运行时会先清除 .claude/ 目录下所有以 @ 开头的文件夹
  • 已存在的同名链接会被覆盖
  • 找不到的包会显示警告并继续处理其他包
`);
}

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);

  // 检查帮助参数
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const targets = args.filter(arg => !arg.startsWith('--'));

  if (targets.length === 0) {
    console.error('错误: 请提供至少一个目标目录名\n');
    console.log('运行 --help 查看详细使用说明:');
    console.log('  pnpm run link-skills -- --help');
    console.log('  node scripts/link-skills.js --help\n');
    process.exit(1);
  }

  return { dryRun, targets };
}

// 扫描目标目录，查找所有包含指定插件目录的子包
function scanForPluginDirs(targetDir, nodeModulesPath, pluginDir) {
  const targetPath = path.join(nodeModulesPath, targetDir);

  if (!fs.existsSync(targetPath)) {
    console.warn(`\n警告: 目标目录不存在: ${targetPath}`);
    return [];
  }

  const results = [];
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });

  // 对于 commands 和 agents，不需要深层扫描，直接链接整个目录
  const needsDeepScan = pluginDir === 'skills';

  for (const entry of entries) {
    const packagePath = path.join(targetPath, entry.name);

    // 使用 fs.statSync 跟随符号链接检查是否为目录
    let isDir;
    try {
      isDir = fs.statSync(packagePath).isDirectory();
    } catch (error) {
      continue; // 跳过无法访问的条目
    }

    if (!isDir) continue;

    const packageName = entry.name;
    const pluginPath = path.join(packagePath, '.claude-plugin', pluginDir);

    // 同样使用 statSync 跟随符号链接
    let hasPluginDir;
    try {
      hasPluginDir = fs.existsSync(pluginPath)
        && fs.statSync(pluginPath).isDirectory();
    } catch (error) {
      hasPluginDir = false;
    }

    if (!hasPluginDir) continue;

    if (needsDeepScan) {
      // 对于 skills，需要扫描子目录
      const pluginEntries = fs.readdirSync(pluginPath, { withFileTypes: true });
      const items = [];

      for (const pluginEntry of pluginEntries) {
        const itemPath = path.join(pluginPath, pluginEntry.name);
        try {
          if (fs.statSync(itemPath).isDirectory()) {
            items.push(pluginEntry.name);
          }
        } catch (error) {
          // 跳过无法访问的条目
        }
      }

      if (items.length > 0) {
        results.push({
          packageName,
          packagePath,
          pluginPath,
          items
        });
      }
    } else {
      // 对于 commands 和 agents，直接返回整个目录
      results.push({
        packageName,
        packagePath,
        pluginPath,
        items: null // null 表示直接链接整个目录
      });
    }
  }

  return results;
}

// 清理 .claude/ 目录下所有以 @ 开头的文件夹
function cleanClaudeDirs(dryRun) {
  const claudeBasePath = path.join(__dirname, '..', '.claude');
  let totalCleaned = 0;

  console.log('\n清理 .claude/ 目录下所有以 @ 开头的文件夹...');
  console.log('-'.repeat(60));

  for (const pluginDir of PLUGIN_DIRS) {
    const claudeDirPath = path.join(claudeBasePath, pluginDir);

    if (!fs.existsSync(claudeDirPath)) {
      continue;
    }

    try {
      const entries = fs.readdirSync(claudeDirPath, { withFileTypes: true });
      const itemsToRemove = [];

      for (const entry of entries) {
        // 只处理以 @ 开头的文件夹（包括符号链接）
        if (entry.name.startsWith('@')) {
          const itemPath = path.join(claudeDirPath, entry.name);
          try {
            const stat = fs.lstatSync(itemPath);
            // 检查是否为目录或符号链接（junction）
            if (stat.isDirectory() || stat.isSymbolicLink()) {
              itemsToRemove.push(entry.name);
            }
          } catch (error) {
            // 跳过无法访问的条目
            continue;
          }
        }
      }

      if (itemsToRemove.length > 0) {
        console.log(`\n  ${pluginDir}/ 目录:`);
        for (const itemName of itemsToRemove) {
          const itemPath = path.join(claudeDirPath, itemName);
          if (dryRun) {
            console.log(`    [预览] 将删除: ${itemName}`);
          } else {
            try {
              const stat = fs.lstatSync(itemPath);
              if (stat.isSymbolicLink()) {
                fs.unlinkSync(itemPath);
              } else if (stat.isDirectory()) {
                fs.rmSync(itemPath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(itemPath);
              }
              console.log(`    ✓ 已删除: ${itemName}`);
              totalCleaned++;
            } catch (error) {
              console.error(`    ✗ 删除失败: ${itemName} - ${error.message}`);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`  警告: 无法读取 ${pluginDir} 目录: ${error.message}`);
    }
  }

  if (dryRun) {
    console.log('\n  [预览模式] 不会实际删除文件');
  } else {
    console.log(`\n清理完成: 已删除 ${totalCleaned} 个文件夹`);
  }
  console.log('-'.repeat(60));
}

// 创建符号链接
function createSymlink(source, target, dryRun) {
  const absoluteSource = path.resolve(source);
  const absoluteTarget = path.resolve(target);

  if (dryRun) {
    console.log(`  [预览] ${path.basename(target)} -> ${path.basename(source)}`);
    return true;
  }

  try {
    // 如果目标已存在，先删除
    if (fs.existsSync(absoluteTarget)) {
      const stat = fs.lstatSync(absoluteTarget);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(absoluteTarget);
      } else if (stat.isDirectory()) {
        fs.rmSync(absoluteTarget, { recursive: true, force: true });
      } else {
        fs.unlinkSync(absoluteTarget);
      }
    }

    // 创建符号链接 (Windows: junction, Unix: dir)
    const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(absoluteSource, absoluteTarget, symlinkType);
    console.log(`  ✓ ${path.basename(target)} -> ${path.basename(source)}`);
    return true;
  } catch (error) {
    console.error(`  ✗ 创建链接失败: ${error.message}`);
    if (error.code === 'EPERM') {
      console.error('    提示: 可能需要管理员权限');
    }
    return false;
  }
}

// 主函数
async function main() {
  const { dryRun, targets } = parseArgs();

  console.log('='.repeat(60));
  console.log('自动链接插件资源到 .claude/ 目录');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('\n[预览模式] 不会创建实际链接\n');
  }

  // 先清理 .claude/ 目录下所有以 @ 开头的文件夹
  cleanClaudeDirs(dryRun);

  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');

  let totalItems = 0;
  let successCount = 0;

  for (const target of targets) {
    console.log(`\n扫描: ${target}`);
    console.log('-'.repeat(60));

    let foundAny = false;

    for (const pluginDir of PLUGIN_DIRS) {
      const packagesWithItems = scanForPluginDirs(target, nodeModulesPath, pluginDir);

      if (packagesWithItems.length === 0) {
        continue;
      }

      foundAny = true;
      console.log(`\n  发现 ${pluginDir} 资源:`);

      // 提取 scope（如果 target 以 @ 开头，则使用它；否则使用 target 作为 scope）
      const scope = target.startsWith('@') ? target : `@${target}`;

      for (const { packageName, items, pluginPath } of packagesWithItems) {
        const claudeDirPath = path.join(__dirname, '..', '.claude', pluginDir);

        // 确保 .claude/{pluginDir} 目录存在
        if (!dryRun && !fs.existsSync(claudeDirPath)) {
          fs.mkdirSync(claudeDirPath, { recursive: true });
        }

        if (items === null) {
          // 对于 commands 和 agents，直接链接整个目录
          totalItems++;
          // 使用 @{scope}__{packageName} 格式
          const linkName = `${scope}__${packageName}`;
          const targetLinkPath = path.join(claudeDirPath, linkName);
          const success = createSymlink(pluginPath, targetLinkPath, dryRun);
          if (success) successCount++;
        } else {
          // 对于 skills，遍历子目录并链接
          for (const itemName of items) {
            totalItems++;
            const sourceItemPath = path.join(pluginPath, itemName);
            // skills: 使用 @{scope}__{packageName}__{itemName} 格式
            const linkName = `${scope}__${packageName}__${itemName}`;
            const targetLinkPath = path.join(claudeDirPath, linkName);

            const success = createSymlink(sourceItemPath, targetLinkPath, dryRun);
            if (success) successCount++;
          }
        }
      }
    }

    if (!foundAny) {
      console.log(`  未找到包含 .claude-plugin/ 资源的子包`);
    }
  }

  console.log('\n' + '='.repeat(60));
  if (dryRun) {
    console.log(`预览完成: 将创建 ${totalItems} 个资源链接`);
  } else {
    console.log(`操作完成: 成功创建 ${successCount}/${totalItems} 个资源链接`);
  }
  console.log('='.repeat(60));

  if (!dryRun && successCount < totalItems) {
    process.exit(1);
  }
}

// 执行
main().catch((error) => {
  console.error('\n操作失败:', error.message);
  process.exit(1);
});
