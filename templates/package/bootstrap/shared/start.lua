-- Bootstrap 启动器核心模块
-- 统一的启动入口，支持客户端和服务端配置

local Bootstrap = {}

-- 查找定义启动脚本
local parent = script.Parent :: ObjectValue
local targetShared = parent.Value :: ModuleScript | nil

function getPath(moduleScript:ModuleScript)
	local parent = moduleScript.Parent
	local path = moduleScript.Name
	while parent do
		path = parent.Name .. "/" .. path
		parent = parent.Parent
	end
	return path
end


-- 启动函数
-- @param defaultScript 默认启动脚本

-- @param targetScript 目标启动脚本
function Bootstrap.start(defaultScript: ModuleScript | nil, targetScript: ModuleScript | nil)
	if targetShared then
		local path = getPath(targetShared)
		print(string.format("[Bootstrap] 使用共享启动脚本: %s", path))
		targetScript = targetShared
	end

	if not targetScript then
		targetScript = defaultScript
		local path = getPath(targetScript)
		print(string.format("[Bootstrap] 使用默认启动脚本: %s",path))
		
	end

	assert(targetScript and targetScript:IsA("ModuleScript"), "moduleScript must be a ModuleScript")

	require(targetScript)
end

return Bootstrap
