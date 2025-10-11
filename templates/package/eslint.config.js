const eslint = require("@eslint/js");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const prettier = require("eslint-config-prettier");
const prettierPlugin = require("eslint-plugin-prettier");
const robloxTs = require("eslint-plugin-roblox-ts");

module.exports = [
	eslint.configs.recommended,
	prettier,
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 2018,
				sourceType: "module",
				project: "./tsconfig.json",
				jsx: true,
				useJSXTextNode: true,
			},
		},
		plugins: {
			"@typescript-eslint": tsPlugin,
			"roblox-ts": robloxTs,
			prettier: prettierPlugin,
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			...robloxTs.configs["recommended-legacy"].rules,
			"prettier/prettier": "warn",
		},
	},
	{
		files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
		languageOptions: {
			ecmaVersion: 2018,
			sourceType: "commonjs",
			globals: {
				require: "readonly",
				module: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				console: "readonly",
				process: "readonly",
			},
		},
	},
	{
		ignores: [
			"*.test.ts",
			"*.spec.ts",
			"out/**",
			"**/__tests__/**",
			"**/__examples__/**",
		],
	},
];
