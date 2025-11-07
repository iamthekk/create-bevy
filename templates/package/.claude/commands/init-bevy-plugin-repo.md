# 初始化 bevy 插件 仓库

**确保用户已安装 bevy_framework_plugin, superpowers 插件**
否则, 提醒用户安装, 地址为 "https://github.com/white-dragon-core/claude-code-marketspace"

## 了解背景

你需要加载 `bevy 必备技能`, 然后用交互问答的方式询问用户几个问题:

1. 询问是迁移插件还是创新插件
    - 迁移: 跳转到 2
    - 创新: 跳转到 3
2. 询问目标仓库地址
    - 使用 `git submodule add {path} ./repo/{name}`, 检出待迁移仓库.
    - 使用代理了解仓库信息, 提示词: `请加载 bevy 必备技能, 请认真分析 ./repo/{name} 的代码仓库, 仔细思考, 为其迁移至 bevy 插件提供具体可行的方案, 请输出研究报告, 迁移计划,任务分解, **保存方案**到 docs/ 目录`
    - 更新 `CLAUDE.md`
3. 询问用户新插件需求
    - 使用代理将用户需求转化为 `PRD.md`, 提示词: `请加载 bevy 必备技能, 请认真分析 {用户需求}, 仔细思考, 为其开发bevy 插件提供具体可行的方案, 请输出研究报告, 计划,任务分解, **保存方案** docs/ 目录`
    - 更新 `CLAUDE.md`

## 修改模板信息
- .claude-plugin\marketplace.json
- .claude-plugin\plugin.json
- package.json

## 提示下一步
- 如果是迁移, 提示用户: "文档已保存到 docs/ 目录, 您可以使用 /migrate-bevy-plugin-repo 命令开始迁移, 也可以使用自定义的开发流程!"
- 如果是创新, 提示用户: "文档已保存到 docs/ 目录, 您可以使用 /develop-bevy-plugin-repo 命令开始迁移, 也可以使用自定义的开发流程!"