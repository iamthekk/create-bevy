/**
 * 自动链接 node_modules 包中的 skills 目录到 .claude/skills/
 *
 * 功能说明:
 * 1. 扫描指定的 node_modules 子目录（支持 scope，如 @white-dragon-bevy）
 * 2. 查找其中所有子包的 skills/ 目录
 * 3. 将 skills/ 内的每个子目录链接到 .claude/skills/
 * 4. 链接名称格式：{包名}__{技能名}（避免命名冲突）
 *
 * 使用方法:
 * node scripts/link-skills.js @white-dragon-bevy @another-scope
 * node scripts/link-skills.js --dry-run @white-dragon-bevy
 *
 * 注意:
 * - Windows 系统使用 junction 类型链接，不需要管理员权限
 * - --dry-run 参数仅预览，不实际创建链接
 * - 已存在的同名链接会被覆盖
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 显示帮助信息
function showHelp() {
    console.log(`
自动链接 node_modules 包中的 skills 目录到 .claude/skills/

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
  1. 扫描 node_modules/{目录名}/ 下的所有子包
  2. 查找每个子包中的 skills/ 文件夹
  3. 将 skills/ 内的每个子目录链接到 .claude/skills/
  4. 链接命名格式: {包名}__{技能名}

示例路径映射:
  node_modules/@white-dragon-bevy/bevy_unit/skills/abc
    → .claude/skills/bevy_unit__abc

注意事项:
  • Windows 系统使用 junction 类型链接，不需要管理员权限
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

// 扫描目标目录，查找所有包含 skills/ 的子包
function scanForSkills(targetDir, nodeModulesPath) {
    const targetPath = path.join(nodeModulesPath, targetDir);

    if (!fs.existsSync(targetPath)) {
        console.warn(`\n警告: 目标目录不存在: ${targetPath}`);
        return [];
    }

    const results = [];
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });

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
        const skillsPath = path.join(packagePath, 'skills');

        // 同样使用 statSync 跟随符号链接
        let hasSkills;
        try {
            hasSkills = fs.existsSync(skillsPath) && fs.statSync(skillsPath).isDirectory();
        } catch (error) {
            hasSkills = false;
        }

        if (!hasSkills) continue;

        // 读取 skills/ 目录内的子目录
        const skillEntries = fs.readdirSync(skillsPath, { withFileTypes: true });
        const skills = [];

        for (const skillEntry of skillEntries) {
            const skillPath = path.join(skillsPath, skillEntry.name);
            try {
                if (fs.statSync(skillPath).isDirectory()) {
                    skills.push(skillEntry.name);
                }
            } catch (error) {
                // 跳过无法访问的条目
            }
        }

        if (skills.length > 0) {
            results.push({
                packageName,
                packagePath,
                skillsPath,
                skills
            });
        }
    }

    return results;
}

// 创建符号链接
function createSymlink(source, target, dryRun) {
    const absoluteSource = path.resolve(source);
    const absoluteTarget = path.resolve(target);

    if (dryRun) {
        console.log(`  [预览] ${target} -> ${source}`);
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
        console.log(`  ✓ ${target} -> ${source}`);
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
    console.log('自动链接 skills 目录到 .claude/skills/');
    console.log('='.repeat(60));

    if (dryRun) {
        console.log('\n[预览模式] 不会创建实际链接\n');
    }

    const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
    const claudeSkillsPath = path.join(__dirname, '..', '.claude', 'skills');

    // 确保 .claude/skills 目录存在
    if (!dryRun && !fs.existsSync(claudeSkillsPath)) {
        fs.mkdirSync(claudeSkillsPath, { recursive: true });
        console.log(`创建目录: ${claudeSkillsPath}\n`);
    }

    let totalSkills = 0;
    let successCount = 0;

    for (const target of targets) {
        console.log(`\n扫描: ${target}`);
        console.log('-'.repeat(60));

        const packagesWithSkills = scanForSkills(target, nodeModulesPath);

        if (packagesWithSkills.length === 0) {
            console.log(`  未找到包含 skills/ 目录的子包`);
            continue;
        }

        for (const { packageName, skillsPath, skills } of packagesWithSkills) {
            console.log(`\n  包: ${packageName}`);

            for (const skillName of skills) {
                totalSkills++;
                const sourceSkillPath = path.join(skillsPath, skillName);
                const linkName = `${packageName}__${skillName}`;
                const targetLinkPath = path.join(claudeSkillsPath, linkName);

                const success = createSymlink(sourceSkillPath, targetLinkPath, dryRun);
                if (success) successCount++;
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    if (dryRun) {
        console.log(`预览完成: 将创建 ${totalSkills} 个技能链接`);
    } else {
        console.log(`操作完成: 成功创建 ${successCount}/${totalSkills} 个技能链接`);
    }
    console.log('='.repeat(60));

    if (!dryRun && successCount < totalSkills) {
        process.exit(1);
    }
}

// 执行
main().catch(error => {
    console.error('\n操作失败:', error.message);
    process.exit(1);
});
