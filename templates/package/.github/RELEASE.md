---
version: 0.1.0
---

# 发布流程

## 概述

本项目使用独立的 release workflow 来发布到 GitHub Packages。

## 发布步骤

### 1. 更新版本号

编辑 `package.json` 修改版本号：

```json
{
  "version": "0.1.1"
}
```

### 2. 提交版本变更

```bash
git add package.json
git commit -m "chore: bump version to 0.1.1"
git push
```

### 3. 创建并推送 tag

```bash
git tag v0.1.1
git push origin v0.1.1
```

**重要**: tag 版本号必须与 package.json 中的版本号一致！
- Tag: `v0.1.1`
- package.json: `"version": "0.1.1"`

如果不一致，release workflow 会自动失败并报错。

### 4. 自动发布

推送 tag 后，GitHub Actions 会自动执行两个阶段：

**阶段 1: 构建和测试**
1. 验证版本号一致性
2. 构建 TypeScript 项目
3. 构建 Roblox Place 文件
4. 运行完整的单元测试

**阶段 2: 发布 (仅在测试通过后)**
1. 构建发布版本
2. 发布到 GitHub Packages
3. 创建 GitHub Release

如果测试失败，发布流程会自动中止，不会发布有问题的版本。

## CI 流程

### 主 CI (ci.yml)
- 触发条件: push 到 master 或 pull request
- 执行内容:
  - 编译 TypeScript
  - 构建 Roblox Place
  - 运行单元测试
  - 上传测试报告

### Release 流程 (release.yml)
- 触发条件: 推送 `v*.*.*` tag
- 执行内容:
  - 编译并构建
  - 发布到 GitHub Packages
  - 创建 GitHub Release

## 安装已发布的包

```bash
# 配置 npm 使用 GitHub Packages
npm config set @white-dragon-bevy:registry https://npm.pkg.github.com

# 安装包
pnpm add @white-dragon-bevy/bevy_framework
```
