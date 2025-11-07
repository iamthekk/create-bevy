# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述
<!这里进行项目描述>



## 技术栈

- **语言**: TypeScript (roblox-ts)
- **目标平台**: Roblox
- **ECS框架**: @white-dragon-bevy/bevy_framework
- **包管理器**: pnpm (10.15.0)
- **主要依赖**:
  - @white-dragon-bevy/bevy_framework (workspace依赖)
  - @flamework/core (依赖注入和装饰器)
  - @rbxts/testez (测试框架)

## 常用命令

```bash
# 构建项目
pnpm build
# 或
npm run build

# 监视模式构建
pnpm watch
# 或
npm run watch

# 安装依赖
pnpm install

# 代码检查
pnpm lint

# 运行测试 (test-cloud-testez)
npm test

# 运行特定测试
npm test < caseName or file name >

```


## 其他
- **Claude Code技能**: 保存在 `skills/` 目录