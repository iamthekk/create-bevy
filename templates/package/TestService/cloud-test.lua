--[[
	Roblox Cloud 测试执行脚本

	功能说明：
	1. 在 Roblox Cloud 环境中运行 TestEZ 测试
	2. 根据是否有 testNamePattern 决定使用哪种 Reporter：
	   - 有 pattern：使用 CustomReporter 捕获详细日志（测试树、状态标记等）
	   - 无 pattern：使用 TextReporter 正常输出（日志被丢弃）
	3. 将测试结果（统计、错误、日志）编码为 JSON 返回

	为什么需要自定义 Reporter？
	- Roblox Cloud Luau Execution API 只捕获脚本的 return 值
	- print() 输出完全被丢弃，无法获取
	- CustomReporter 将输出存入数组而不是 print()，从而能够返回详细日志

	模板变量：
	- TEST_NAME_PATTERN: 由 JS 脚本注入的测试名称过滤模式（在代码中使用占位符）
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
if RunService:IsStudio() and not RunService:IsRunMode() then
	return
end

-- 在测试执行前设置全局标志,供 TypeScript 代码检测云端测试环境
_G.__isInCloud__ = true

-- 引入 HttpService（用于 JSON 编码）
local HttpService = game:GetService("HttpService")

-- 测试目标目录
local targetDir = ReplicatedStorage.rbxts_include.node_modules["@white-dragon-bevy"]

-- 引入 testez
local TestEZ = require(game.ReplicatedStorage.rbxts_include.node_modules["@rbxts"].testez.src)
local TextReporter = require(game.ReplicatedStorage.rbxts_include.node_modules["@rbxts"].testez.src.Reporters.TextReporter)

-- 从脚本注入获取测试名称过滤模式
local testNamePattern = "{{TEST_NAME_PATTERN}}"
if testNamePattern == "" then
	testNamePattern = nil
end

-- 创建自定义 Reporter 来捕获输出
local capturedLogs = {}
local CustomReporter = {}

function CustomReporter.report(results)
	-- 使用原始 TextReporter 的逻辑生成输出
	local TestEnum = require(game.ReplicatedStorage.rbxts_include.node_modules["@rbxts"].testez.src.TestEnum)
	local INDENT = ("   ")
	local STATUS_SYMBOLS = {
		[TestEnum.TestStatus.Success] = "+",
		[TestEnum.TestStatus.Failure] = "-",
		[TestEnum.TestStatus.Skipped] = "~"
	}

	local function compareNodes(a, b)
		return a.planNode.phrase:lower() < b.planNode.phrase:lower()
	end

	local function reportNode(node, buffer, level)
		buffer = buffer or {}
		level = level or 0

		if node.status == TestEnum.TestStatus.Skipped then
			return buffer
		end

		local line
		if node.status then
			local symbol = STATUS_SYMBOLS[node.status] or "?"
			line = ("%s[%s] %s"):format(INDENT:rep(level), symbol, node.planNode.phrase)
		else
			line = ("%s%s"):format(INDENT:rep(level), node.planNode.phrase)
		end

		table.insert(buffer, line)
		table.sort(node.children, compareNodes)

		for _, child in ipairs(node.children) do
			reportNode(child, buffer, level + 1)
		end

		return buffer
	end

	local function reportRoot(node)
		local buffer = {}
		table.sort(node.children, compareNodes)
		for _, child in ipairs(node.children) do
			reportNode(child, buffer, 0)
		end
		return buffer
	end

	local buffer = reportRoot(results)
	local reportText = table.concat(buffer, "\n")

	-- 捕获输出而不是打印
	table.insert(capturedLogs, "Test results:")
	table.insert(capturedLogs, reportText)
	table.insert(capturedLogs, ("%d passed, %d failed, %d skipped"):format(
		results.successCount,
		results.failureCount,
		results.skippedCount
	))

	if results.failureCount > 0 then
		table.insert(capturedLogs, ("%d test nodes reported failures."):format(results.failureCount))
	end

	if #results.errors > 0 then
		table.insert(capturedLogs, "Errors reported by tests:")
		table.insert(capturedLogs, "")
		for _, message in ipairs(results.errors) do
			table.insert(capturedLogs, tostring(message))
			table.insert(capturedLogs, "")
		end
	end
end

-- 根据是否有 pattern 选择 Reporter
local reporter
if testNamePattern then
	reporter = CustomReporter
else
	reporter = TestEZ.Reporters.TextReporter
end

-- 递归扫描测试文件的函数
local function scanTestFiles(parent)
	local testFiles = {}

	for _, child in ipairs(parent:GetChildren()) do
		-- 检查是否是测试文件（ModuleScript 且名称包含 .spec）
		if child:IsA("ModuleScript") and child.Name:lower():find("%.spec") then
			table.insert(testFiles, child)
		end

		-- 递归扫描所有对象的子对象（包括 ModuleScript）
		-- 因为 Roblox 中 ModuleScript 也可以包含子对象（例如带 init.lua 的目录）
		local success, children = pcall(function() return child:GetChildren() end)
		if success and #children > 0 then
			local subFiles = scanTestFiles(child)
			for _, file in ipairs(subFiles) do
				table.insert(testFiles, file)
			end
		end
	end

	return testFiles
end

-- 文件名匹配函数（不区分大小写）
local function matchesPattern(fileName, pattern)
	-- 使用不区分大小写的纯文本匹配
	return fileName:lower():find(pattern:lower(), 1, true) ~= nil
end

-- 根据 pattern 决定要测试的目标
local testTargets
local testOptions
if testNamePattern then
	-- 扫描所有测试文件
	local allTestFiles = scanTestFiles(targetDir)

	-- 过滤出文件名匹配的文件
	testTargets = {}
	for _, testFile in ipairs(allTestFiles) do
		if matchesPattern(testFile.Name, testNamePattern) then
			table.insert(testTargets, testFile)
		end
	end

	-- 如果没有匹配的文件，返回友好提示
	if #testTargets == 0 then
		local output = {
			success = false,
			totalTests = 0,
			passed = 0,
			failed = 0,
			skipped = 0,
			errors = {{
				testName = "Pattern matching",
				message = ("No test files found matching pattern: '%s'"):format(testNamePattern),
				trace = ("Total test files available: %d"):format(#allTestFiles)
			}}
		}
		return HttpService:JSONEncode(output)
	end

	testOptions = {}  -- 不使用 testNamePattern，因为已经在文件级别过滤了
else
	-- 无 pattern 时保持原逻辑
	testTargets = {targetDir}
	testOptions = {}
end

-- 运行测试并收集结果
local results = TestEZ.TestBootstrap:run(testTargets, reporter, testOptions)

-- 从 results 手动收集错误信息(包含测试名称)
-- 使用 Map 存储错误,优先保留有测试名称的版本
local errorMap = {}
local errors = {}

-- 遍历所有节点收集错误及其测试名称
local function collectErrors(node, parentPath)
	local currentPath = parentPath
	if node.planNode and node.planNode.phrase then
		currentPath = parentPath == "" and node.planNode.phrase or (parentPath .. " > " .. node.planNode.phrase)
	end

	-- 如果当前节点有错误,收集它们
	if node.errors and #node.errors > 0 then
		for _, errorMessage in ipairs(node.errors) do
			local msgStr = tostring(errorMessage)
			local testName = currentPath ~= "" and currentPath or "Unknown"

			-- 分离错误消息和堆栈跟踪
			-- 第一行通常是错误消息,其余是堆栈跟踪
			local message = ""
			local trace = ""
			local lines = {}
			for line in msgStr:gmatch("[^\r\n]+") do
				table.insert(lines, line)
			end

			if #lines > 0 then
				message = lines[1]
				if #lines > 1 then
					-- 将剩余行作为堆栈跟踪
					for i = 2, #lines do
						if trace ~= "" then
							trace = trace .. "\n"
						end
						trace = trace .. lines[i]
					end
				end
			else
				message = msgStr
			end

			-- 如果是新错误,或者当前版本有测试名称而之前的没有,则更新
			if not errorMap[msgStr] or (testName ~= "Unknown" and errorMap[msgStr].testName == "Unknown") then
				errorMap[msgStr] = {
					testName = testName,
					message = message,
					trace = trace
				}
			end
		end
	end

	-- 递归处理子节点
	if node.children then
		for _, child in ipairs(node.children) do
			collectErrors(child, currentPath)
		end
	end
end

collectErrors(results, "")

-- 将 Map 转换为数组
for _, errorData in pairs(errorMap) do
	table.insert(errors, errorData)
end

-- 返回测试结果
local output = {
	success = results.failureCount == 0,
	totalTests = results.successCount + results.failureCount,
	passed = results.successCount,
	failed = results.failureCount,
	skipped = results.skippedCount or 0,
	errors = errors
}

-- 如果捕获了日志，添加到输出中
if #capturedLogs > 0 then
	output.logs = capturedLogs
end

-- 返回 JSON 格式
return HttpService:JSONEncode(output)
