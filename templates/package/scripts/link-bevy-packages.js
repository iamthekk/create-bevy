/**
 * @white-dragon-bevy 包链接脚本
 *
 * 功能说明:
 * 1. 自动读取 package.json 中所有 @white-dragon-bevy/* 依赖
 * 2. 删除 node_modules/@white-dragon-bevy 目录
 * 3. 验证所有包在父级目录中存在 (例如: @white-dragon-bevy/bevy_framework -> ../bevy_framework)
 * 4. 为每个包创建符号链接 (out 目录) 和复制 package.json
 *
 * 使用方法:
 * node script/link-rbxts-packages.js
 *
 * 注意:
 * - Windows 系统需要管理员权限运行以创建符号链接
 * - 如果找不到包路径会报错并退出
 */

const fs = require('fs');
const path = require('path');

// 在 CI 环境中跳过此脚本
if (process.env.CI) {
    console.log('检测到 CI 环境，跳过 @white-dragon-bevy 包链接脚本');
    process.exit(0);
}

console.log('开始重新链接 @white-dragon-bevy 包...');

try {
    // 1. 读取 package.json
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // 2. 获取所有 @white-dragon-bevy 开头的依赖
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const whiteDragonPackages = Object.keys(allDeps).filter(name => name.startsWith('@white-dragon-bevy/'));

    if (whiteDragonPackages.length === 0) {
        console.log('未找到任何 @white-dragon-bevy 开头的依赖');
        process.exit(0);
    }

    console.log(`找到 ${whiteDragonPackages.length} 个 @white-dragon-bevy 包:`, whiteDragonPackages);

    // 3. 删除 node_modules/@white-dragon-bevy 目录
    const whiteDragonNodeModulesPath = path.join(__dirname, '..', 'node_modules', '@white-dragon-bevy');
    console.log(`\n删除现有的 node_modules/@white-dragon-bevy...`);
    if (fs.existsSync(whiteDragonNodeModulesPath)) {
        fs.rmSync(whiteDragonNodeModulesPath, { recursive: true, force: true });
        console.log('已删除 node_modules/@white-dragon-bevy');
    } else {
        console.log('node_modules/@white-dragon-bevy 目录不存在');
    }

    // 4. 验证所有包在 ../ 目录中存在
    console.log('\n验证包路径...');
    const packagePaths = [];
    for (const packageName of whiteDragonPackages) {
        // 从 @white-dragon-bevy/bevy_framework 提取 bevy_framework
        const folderName = packageName.replace('@white-dragon-bevy/', '');
        const targetPath = path.join(__dirname, '..', '..', folderName);

        if (!fs.existsSync(targetPath)) {
            console.error(`错误: 未找到包路径: ${targetPath}`);
            console.error(`包 ${packageName} 应该位于 ${targetPath}`);
            process.exit(1);
        }

        console.log(`✓ 找到 ${packageName} -> ${targetPath}`);
        packagePaths.push({ packageName, folderName, targetPath });
    }

    // 5. 为每个包创建链接和复制文件
    console.log('\n开始创建链接...');
    for (const { packageName, folderName, targetPath } of packagePaths) {
        console.log(`\n处理 ${packageName}...`);

        const nodeModulesPackagePath = path.join(__dirname, '..', 'node_modules', '@white-dragon-bevy', folderName);
        const targetOutPath = path.join(targetPath, 'out');
        const targetPackageJsonPath = path.join(targetPath, 'package.json');
        const linkOutPath = path.join(nodeModulesPackagePath, 'out');
        const linkPackageJsonPath = path.join(nodeModulesPackagePath, 'package.json');

        // 创建包目录
        fs.mkdirSync(nodeModulesPackagePath, { recursive: true });
        console.log(`  创建目录: ${nodeModulesPackagePath}`);

        // 检查 out 目录是否存在
        const absoluteTargetOutPath = path.resolve(targetOutPath);
        if (!fs.existsSync(absoluteTargetOutPath)) {
            console.warn(`  警告: 目标 out 路径不存在: ${absoluteTargetOutPath}`);
        } else {
            // 创建 out 目录符号链接
            fs.symlinkSync(absoluteTargetOutPath, linkOutPath, 'junction');
            console.log(`  创建链接: ${linkOutPath} -> ${absoluteTargetOutPath}`);
        }

        // 复制 package.json
        const absoluteTargetPackageJsonPath = path.resolve(targetPackageJsonPath);
        if (fs.existsSync(absoluteTargetPackageJsonPath)) {
            fs.copyFileSync(absoluteTargetPackageJsonPath, linkPackageJsonPath);
            console.log(`  复制文件: ${linkPackageJsonPath}`);
        } else {
            console.warn(`  警告: package.json 文件不存在: ${absoluteTargetPackageJsonPath}`);
        }
    }

    console.log('\n操作完成!');
    console.log(`成功处理了 ${packagePaths.length} 个包`);

} catch (error) {
    console.error('操作失败:', error.message);

    if (error.code === 'EPERM') {
        console.error('权限不足，请以管理员权限运行此脚本');
    }

    process.exit(1);
}
