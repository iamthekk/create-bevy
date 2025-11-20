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
import { App, DefaultPlugins, Main } from "@white-dragon-bevy/bevy_framework";

function fooSystem(world: BevyWorld) {}

/**
 * 创建并配置带有默认插件的应用
 *
 * @returns 配置好的应用实例
 */
export function createApp(): App {

	// 创建新的 App 实例并添加 Roblox 默认插件集
	// 这相当于 Rust Bevy 中的：App::new().add_plugins(DefaultPlugins).run()
	const app = App.create().addPlugins(DefaultPlugins.create());

	app.addSystems(Main, fooSystem);

	return app;
}

if (RunService.IsServer()) {
	// 本例子不需要在服务端运行
} else {
	const app = createApp();
	app.run();
}
