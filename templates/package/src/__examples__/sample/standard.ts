/**
 * Bevy empty_defaults 示例
 *
 * 创建一个带有默认插件的空应用程序 对应 Rust Bevy 示例：examples/app/empty_defaults.rs
 *
 * 这个示例演示了最基本的 Bevy 应用程序结构：
 *
 * - 创建 App 实例
 * - 添加默认插件集（在 Roblox 环境中使用 RobloxDefaultPlugins）
 * - 运行应用程序
 */

/**
 * Bevy empty_defaults 示例
 *
 * 创建一个带有默认插件的空应用程序 对应 Rust Bevy 示例：examples/app/empty_defaults.rs
 *
 * 这个示例演示了最基本的 Bevy 应用程序结构：
 *
 * - 创建 App 实例
 * - 添加默认插件集（在 Roblox 环境中使用 RobloxDefaultPlugins）
 * - 运行应用程序
 */

import { RunService } from "@rbxts/services";
import type { BevyWorld, Context } from "@white-dragon-bevy/bevy_framework";
import { App, DefaultPlugins, MainScheduleLabel } from "@white-dragon-bevy/bevy_framework";

function fooSystem(world: BevyWorld, context: Context) {}

/**
 * 创建并配置带有默认插件的应用
 *
 * @returns 配置好的应用实例
 */
export function createApp(): App {
	const isServer = RunService.IsServer();
	const isClient = RunService.IsClient();

	print("=".rep(60));
	print("🏗️ 默认插件应用示例 (Empty App With Defaults)");
	print("=".rep(60));
	print("📋 功能概述:");
	print("   创建一个带有默认插件集的空应用程序");
	print("   展示标准 Bevy 应用程序的完整初始化流程");
	print("");
	print("🌐 运行环境:");
	print(`   - 服务端: ${isServer ? "是" : "否"}`);
	print(`   - 客户端: ${isClient ? "是" : "否"}`);
	print("");
	print("⚙️ 技术要点:");
	print("   - 使用 DefaultPlugins 创建完整的插件生态");
	print("   - 包含日志、调度、事件等基础服务");
	print("   - 对应 Rust Bevy 的标准应用模板");
	print("");
	print("🎯 用途:");
	print("   - 生产环境应用的起始模板");
	print("   - 学习 Bevy 标准插件架构");
	print("   - 验证完整插件生态系统");
	print("");
	print("🔧 包含的默认插件:");
	print("   - 核心调度系统");
	print("   - 事件管理系统");
	print("   - 时间和生命周期管理");
	print("   - Roblox 平台集成");
	print("=".rep(60));
	print("");

	// 创建新的 App 实例并添加 Roblox 默认插件集
	// 这相当于 Rust Bevy 中的：App::new().add_plugins(DefaultPlugins).run()
	const app = App.create().addPlugins(DefaultPlugins.create());

	app.addSystems(MainScheduleLabel.MAIN, fooSystem);

	return app;
}

if (RunService.IsServer()) {
	// 本例子不需要在服务端运行
} else {
	const app = createApp();
	app.run();
}
