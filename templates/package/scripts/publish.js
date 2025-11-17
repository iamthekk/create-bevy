// scripts/publish.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. 定义源目录和目标目录
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'out');
const packageJsonPath = path.resolve(rootDir, 'package.json');

// 2. 读取根目录的 package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// 3. 清理不必要的字段，避免开发依赖等信息被发布
delete packageJson.scripts;
delete packageJson.devDependencies;
// 如果有其他不想发布的字段，也可以在这里删除
// delete packageJson.someOtherField;

// 4. 将清理后的 package.json 写入 out 目录
fs.writeFileSync(
  path.resolve(outDir, 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// copy .npmrc to out directory
fs.copyFileSync(
  path.resolve(rootDir, '.npmrc'),
  path.resolve(outDir, '.npmrc')
);

// 5. 如果存在 .claude-plugin/ 目录，将其拷贝到 out/ 目录
const claudePluginDir = path.resolve(rootDir, '.claude-plugin');
const targetDir = path.resolve(outDir, '.claude-plugin');

if (fs.existsSync(claudePluginDir)) {
  // 如果目标目录已存在，先删除
  if (fs.existsSync(targetDir)) {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true });
    } catch (err) {
      console.warn('Warning: Failed to remove existing .claude-plugin directory:', err.message);
    }
  }
  
  // 复制整个目录，dereference: true 确保复制真实文件而不是符号链接
  try {
    fs.cpSync(claudePluginDir, targetDir, { recursive: true, dereference: true });
    console.log('Copied .claude-plugin directory to out/.claude-plugin');
  } catch (err) {
    console.error('Error copying .claude-plugin directory:', err.message);
  }
}

// 6. 在 out 目录中执行 npm publish
console.log('Publishing from out directory...');
execSync('npm publish', { cwd: outDir, stdio: 'inherit' });

console.log('Package published successfully!');