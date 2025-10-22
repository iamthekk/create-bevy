/**
 * Bevy Framework 示例索引
 *
 * 此文件用于选择和运行不同的示例程序 展示 Bevy Framework 的各种功能和用法
 */

import { RunService } from "@rbxts/services";

import runConfig from "./run.json";

// Choose which example to run
const exampleFolder: string = runConfig.exampleFolder; // Change to other example folders
const exampleName: string = runConfig.exampleName; // Change to other example names

/** 启动指定的示例 此函数会根据配置加载相应的示例模块并运行 */
export function bootstrap(): void {
	const folder = script.FindFirstChild(exampleFolder);
	assert(folder, `can't find exampleFolder :${exampleFolder}`);
	const exampleScript = folder.FindFirstChild(exampleName) as ModuleScript;
	assert(exampleScript, `can't find exampleScript :${exampleName}`);

	print(`[Examples] 正在加载示例: ${exampleFolder}/${exampleName}`);
	require(exampleScript);
}
