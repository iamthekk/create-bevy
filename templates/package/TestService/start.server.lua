local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
if not RunService:IsRunMode() then
	return
end

-- 测试目标目录
local targetDir = ReplicatedStorage.rbxts_include.node_modules["@white-dragon-bevy"]["bevy_framework"]


-- 引入 testez 运行单元测试
require(game.ReplicatedStorage.rbxts_include.node_modules["@rbxts"].testez.src).TestBootstrap:run({
	targetDir,

},	nil)