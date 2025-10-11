import { spawn } from "child_process";
import fs from "fs-extra";
import kleur from "kleur";
import { lookpath } from "lookpath";
import path from "path";
import prompts from "prompts";
import yargs from "yargs";

import { PACKAGE_ROOT, PROJECT_SCOPE, RBXTS_SCOPE, TEMPLATES_DIR } from "../constants";
import { InitError } from "../errors/InitError";
import { benchmark } from "../util/benchmark";

interface InitOptions {
	compilerVersion?: string;
	dir?: string;
	yes?: boolean;
	packageManager?: PackageManager;
	skipBuild?: boolean;
	gitProtocol?: GitProtocol;
}

enum InitMode {
	None = "none",
	Game = "game",
	Package = "package",
}

enum PackageManager {
	NPM = "npm",
	Yarn = "yarn",
	PNPM = "pnpm",
}

enum GitProtocol {
	HTTPS = "https",
	SSH = "ssh",
}

interface RepositoryConfig {
	name: string;
	https: string;
	ssh: string;
	destination: string;
	templates?: string[];
}

interface RepositoriesConfig {
	repositories: RepositoryConfig[];
}

interface PackageManagerCommands {
	init: string;
	devInstall: string;
	build: string;
}

const packageManagerCommands: {
	[K in PackageManager]: PackageManagerCommands;
} = {
	[PackageManager.NPM]: {
		init: "npm init -y",
		devInstall: "npm install --silent -D",
		build: "npm run build",
	},
	[PackageManager.Yarn]: {
		init: "yarn init -y",
		devInstall: "yarn add --silent -D",
		build: "yarn run build",
	},
	[PackageManager.PNPM]: {
		init: "pnpm init",
		devInstall: "pnpm install --silent -D",
		build: "pnpm run build",
	},
};

function cmd(cmdStr: string, cwd: string) {
	return new Promise<string>((resolve, reject) => {
		const [command, ...args] = cmdStr.split(" ");
		const childProcess = spawn(command, args, { cwd, shell: true });
		let output = "";
		childProcess.stdout.on("data", data => (output += data));
		childProcess.stderr.on("data", data => (output += data));
		childProcess.on("close", code =>
			code === 0
				? resolve(output)
				: reject(new InitError(`Command "${cmdStr}" exited with code ${code}\n\n${output}`)),
		);
		childProcess.on("error", reject);
	});
}

const GIT_IGNORE = ["/node_modules", "/out", "/include", "*.tsbuildinfo"];

async function init(argv: yargs.Arguments<InitOptions>, initMode: InitMode) {
	const compilerVersion = argv.compilerVersion;

	const { dir = argv.dir } = await prompts(
		[
			{
				type: () => argv.dir === undefined && "text",
				name: "dir",
				message: "Project directory",
			},
		],
		{ onCancel: () => process.exit(1) },
	);

	const cwd = path.resolve(dir);
	if (!(await fs.pathExists(cwd))) {
		await fs.ensureDir(cwd);
	}

	if (!(await fs.stat(cwd)).isDirectory()) {
		throw new InitError(`${cwd} is not a directory!`);
	}

	// Detect if there are any additional package managers
	// We don't need to prompt the user to use additional package managers if none are installed

	// Although npm is installed by default, it can be uninstalled
	// and replaced by another manager, so check for it to make sure
	const [npmAvailable, pnpmAvailable, yarnAvailable, gitAvailable] = (
		await Promise.allSettled(["npm", "pnpm", "yarn", "git"].map(v => lookpath(v)))
	).map(v => (v.status === "fulfilled" ? v.value !== undefined : true));

	// Git 是必须的，如果没有安装则抛出错误
	if (!gitAvailable) {
		throw new InitError(
			"Git is required but not found. Please install Git from https://git-scm.com/ and try again.",
		);
	}

	const packageManagerExistance: { [K in PackageManager]: boolean } = {
		[PackageManager.NPM]: npmAvailable,
		[PackageManager.PNPM]: pnpmAvailable,
		[PackageManager.Yarn]: yarnAvailable,
	};

	const packageManagerCount = Object.values(packageManagerExistance).filter(exists => exists).length;

	// Load repository configuration
	const repoConfigPath = path.join(PACKAGE_ROOT, "repositories.json");
	let repoConfig: RepositoriesConfig | undefined;
	if (await fs.pathExists(repoConfigPath)) {
		try {
			repoConfig = await fs.readJson(repoConfigPath);
		} catch (error) {
			// Ignore if repositories.json is malformed
		}
	}
	const hasRepositories = repoConfig && repoConfig.repositories && repoConfig.repositories.length > 0;

	const {
		template = initMode,
		packageManager = argv.packageManager ?? PackageManager.NPM,
		gitProtocol = argv.gitProtocol ?? GitProtocol.SSH,
	}: {
		template: InitMode;
		packageManager: PackageManager;
		gitProtocol: GitProtocol;
	} = await prompts(
		[
			{
				type: () => initMode === InitMode.None && "select",
				name: "template",
				message: "Select template",
				choices: [InitMode.Game, InitMode.Package].map(value => ({
					title: value,
					value,
				})),
				initial: 0,
			},
			{
				type: () =>
					argv.packageManager === undefined && packageManagerCount > 1 && argv.yes === undefined && "select",
				name: "packageManager",
				message: "Multiple package managers detected. Select package manager:",
				choices: Object.entries(PackageManager)
					.filter(([, packageManager]) => packageManagerExistance[packageManager])
					.map(([managerDisplayName, managerEnum]) => ({
						title: managerDisplayName,
						value: managerEnum,
					})),
			},
			{
				type: () => argv.gitProtocol === undefined && hasRepositories && argv.yes === undefined && "select",
				name: "gitProtocol",
				message: "Select Git protocol for cloning repositories:",
				choices: [
					{ title: "SSH", value: GitProtocol.SSH },
					{ title: "HTTPS", value: GitProtocol.HTTPS },
				],
				initial: 0,
			},
		],
		{ onCancel: () => process.exit(1) },
	);

	const paths = {
		packageJson: path.join(cwd, "package.json"),
		packageLockJson: path.join(cwd, "package-lock.json"),
		tsconfig: path.join(cwd, "tsconfig.json"),
		gitignore: path.join(cwd, ".gitignore"),
	};

	const templateDir = path.join(TEMPLATES_DIR, template);

	const pathValues = Object.values(paths);
	for (const fileName of await fs.readdir(templateDir)) {
		pathValues.push(path.join(cwd, fileName));
	}

	const existingPaths = new Array<string>();
	for (const filePath of pathValues) {
		if (filePath && (await fs.pathExists(filePath))) {
			const stat = await fs.stat(filePath);
			if (stat.isFile() || stat.isSymbolicLink() || (await fs.readdir(filePath)).length > 0) {
				existingPaths.push(path.relative(process.cwd(), filePath));
			}
		}
	}

	if (existingPaths.length > 0) {
		const pathInfo = existingPaths.map(v => `  - ${kleur.yellow(v)}\n`).join("");
		throw new InitError(`Cannot initialize project, process could overwrite:\n${pathInfo}`);
	}

	const selectedPackageManager = packageManagerCommands[packageManager];

	// 1. 先复制所有模板文件
	await benchmark("Copying template files..", async () => {
		await fs.copy(templateDir, cwd);
	});

	// 2. 修改 package.json 的名称和仓库信息
	await benchmark("Updating package.json..", async () => {
		const pkgJson = await fs.readJson(paths.packageJson);

		// 获取项目目录名作为包名
		const dirName = path.basename(cwd);

		// 只修改名称相关的字段
		pkgJson.name = PROJECT_SCOPE + "/" + dirName;

		// 修改 repository 字段
		if (pkgJson.repository) {
			if (typeof pkgJson.repository === "string") {
				// 如果是字符串，替换仓库名
				pkgJson.repository = pkgJson.repository.replace(
					/github\.com\/[^/]+\/[^/]+/,
					`github.com/white-dragon-bevy/${dirName}`,
				);
			} else if (typeof pkgJson.repository === "object" && pkgJson.repository.url) {
				// 如果是对象，替换 url
				pkgJson.repository.url = pkgJson.repository.url.replace(
					/github\.com\/[^/]+\/[^/]+/,
					`github.com/white-dragon-bevy/${dirName}`,
				);
			}
		}

		await fs.outputFile(paths.packageJson, JSON.stringify(pkgJson, null, 2));
	});

	// 3. 初始化 Git
	await benchmark("Initializing Git..", async () => {
		await cmd("git init", cwd);
		// 模板已经包含 .gitignore，这里只需要确保包含必要的规则
		const existingGitignore = await fs.readFile(paths.gitignore, "utf-8").catch(() => "");
		const requiredRules = GIT_IGNORE.filter(rule => !existingGitignore.includes(rule));
		if (requiredRules.length > 0) {
			await fs.appendFile(paths.gitignore, "\n" + requiredRules.join("\n") + "\n");
		}
	});

	// 4. 安装依赖
	await benchmark("Installing dependencies..", async () => {
		// 运行 npm install 安装模板中定义的所有依赖
		const installCmd =
			packageManager === PackageManager.NPM
				? "npm install --silent"
				: packageManager === PackageManager.Yarn
					? "yarn install --silent"
					: "pnpm install --silent";
		await cmd(installCmd, cwd);
	});

	// Update default.project.json with the correct project name
	const defaultProjectPath = path.join(cwd, "default.project.json");
	if (await fs.pathExists(defaultProjectPath)) {
		await benchmark("Updating project name..", async () => {
			const projectJson = await fs.readJson(defaultProjectPath);
			const pkgJson = await fs.readJson(paths.packageJson);

			// Use the name from package.json
			projectJson.name = pkgJson.name;

			// For package template, also update the node_modules path
			if (template === InitMode.Package) {
				// Extract the package name without scope (e.g., "@white-dragon-bevy/my_plugin" -> "my_plugin")
				const packageNameWithoutScope = pkgJson.name.split("/").pop();

				// Navigate to the target node: tree.ReplicatedStorage.rbxts_include.node_modules["@white-dragon-bevy"]
				const whitedragonBevyNode =
					projectJson.tree?.ReplicatedStorage?.rbxts_include?.node_modules?.["@white-dragon-bevy"];

				if (whitedragonBevyNode && typeof whitedragonBevyNode === "object" && packageNameWithoutScope) {
					// Find the old key (should be the template package name, e.g., "bevy_plugin_example")
					// Filter out Rojo special keys that start with "$"
					const oldKeys = Object.keys(whitedragonBevyNode).filter(key => !key.startsWith("$"));
					if (oldKeys.length > 0) {
						const oldKey = oldKeys[0];
						// Copy the content to the new key
						whitedragonBevyNode[packageNameWithoutScope] = whitedragonBevyNode[oldKey];
						// Delete the old key
						delete whitedragonBevyNode[oldKey];
					}
				}
			}

			await fs.outputFile(defaultProjectPath, JSON.stringify(projectJson, undefined, "\t"));
		});
	}

	// Clone repositories if configured
	if (repoConfig && repoConfig.repositories && repoConfig.repositories.length > 0) {
		const repositoriesToClone = repoConfig.repositories.filter(repo => {
			// If templates is not specified, clone for all templates
			if (!repo.templates || repo.templates.length === 0) {
				return true;
			}
			// Otherwise, check if current template is in the list
			return repo.templates.includes(template);
		});

		if (repositoriesToClone.length > 0) {
			await benchmark("Cloning repositories..", async () => {
				for (const repo of repositoriesToClone) {
					const repoUrl = gitProtocol === GitProtocol.SSH ? repo.ssh : repo.https;
					const destPath = path.join(cwd, repo.destination);

					// Ensure parent directory exists
					await fs.ensureDir(path.dirname(destPath));

					try {
						await cmd(`git clone ${repoUrl} "${destPath}" --depth 1`, cwd);
					} catch (error) {
						if (error instanceof Error) {
							throw new InitError(
								`Failed to clone repository ${repo.name}:\n${error.message}\nPlease check your Git configuration and network connection.`,
							);
						}
						throw error;
					}
				}
			});
		}
	}

	if (!argv.skipBuild) {
		await benchmark("Compiling..", () => cmd(selectedPackageManager.build, cwd));
	}
}

const GAME_DESCRIPTION = "Generate a Roblox place";
const PACKAGE_DESCRIPTION = "Generate a roblox-ts npm package";

/**
 * Defines behavior of `rbxtsc init` command.
 */
export = {
	command: ["$0", "init"],
	describe: "Create a project from a template",
	builder: () =>
		yargs
			.option("compilerVersion", {
				string: true,
				describe: "roblox-ts compiler version",
			})
			.check(argv => {
				if (argv.compilerVersion !== undefined && !/^\d+\.\d+\.\d+$/.test(argv.compilerVersion)) {
					throw new InitError(
						"Invalid --compilerVersion. You must specify a version in the form of X.X.X. (i.e. --compilerVersion 1.2.3)",
					);
				}
				return true;
			}, true)
			.option("dir", {
				string: true,
				describe: "Project directory",
			})
			.option("yes", {
				alias: "y",
				boolean: true,
				describe: "Use recommended options",
			})
			.option("packageManager", {
				choices: Object.values(PackageManager),
				describe: "Choose an alternative package manager",
			})
			.option("skipBuild", {
				boolean: true,
				describe: "Do not run build script",
			})
			.option("gitProtocol", {
				choices: Object.values(GitProtocol),
				describe: "Choose Git protocol for cloning repositories",
			})

			.command(InitMode.Game, GAME_DESCRIPTION, {}, argv => init(argv as never, InitMode.Game))
			.command(InitMode.Package, PACKAGE_DESCRIPTION, {}, argv => init(argv as never, InitMode.Package)),
	handler: argv => init(argv, InitMode.None),
	// eslint-disable-next-line @typescript-eslint/ban-types
} satisfies yargs.CommandModule<{}, InitOptions>;
