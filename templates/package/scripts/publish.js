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



// 6. 在 out 目录中执行 npm publish
console.log('Publishing from out directory...');
execSync('npm publish', { cwd: outDir, stdio: 'inherit' });

console.log('Package published successfully!');