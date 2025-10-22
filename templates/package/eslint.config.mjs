import style from "@isentinel/eslint-config";

import prettier from "eslint-plugin-prettier";

// Shared ESLint baseline coming from @isentinel; here we customize the bits that
// matter for the Roblox Bevy port. Keep changes grouped so future upgrades stay easy.
export default style({
	ignores: [
		// Documentation and structured text
		"**/*.md",
		"**/*.d.ts",
		"**/*.js",
		"**/*.mjs",
		"**/*.json",

		// Configuration formats we lint elsewhere
		"**/*.yaml",
		"**/*.yml",
		"**/*.toml",

		// Static assets
		"assets/**/*.*",
		"asset/**/*.*",

		// Generated outputs
		"dist/",
		"build/",
		"out/",

		// Dependencies and transient files
		"node_modules/",

		// Roblox specific artefacts
		"**/*.lua",
		"**/*.luau",
		"**/*.spec.ts",
		"configs/**/*",
		"**/configs/**/*",
	],
	plugins: {
		prettier,
	},
	react: true,
	rules: {
		// --- General style relaxations ---------------------------------------------------
		"@cspell/spellchecker": "off",
		"antfu/consistent-list-newline": "off",
		"antfu/top-level-function": "off",
		"better-max-params/better-max-params": "off",

		"unicorn/prefer-ternary": "off",
		"id-length": "off",
		"jsdoc/informative-docs": "off",
		"jsdoc/require-description-complete-sentence": "off",
		"jsdoc/require-param": "off",
		"jsdoc/require-returns-check": "off",
		"jsdoc/convert-to-jsdoc-comments": "off",
		"jsdoc/check-param-names": "off",
		"max-classes-per-file": "off",
		"max-depth": "off",
		"max-lines": "off",
		"max-lines-per-function": "off",
		"no-empty": "off",
		"no-inline-comments": "off",
		"no-self-compare": "off",
		"react-hooks-extra/no-unnecessary-use-memo": "off",
		"react-hooks-roblox/rules-of-hooks": "off",
		"roblox/lua-truthiness": "off",
		"shopify/prefer-class-properties": "off",
		"sonar/cognitive-complexity": "off",
		"sonar/no-duplicate-string": "off",
		"sonar/no-nested-incdec": "off",
		"sonar/destructuring-assignment-syntax": "off",
		"sonar/use-type-alias": "off",
		"sonar/no-identical-functions": "off",
		"sonar/no-dead-store": "off",
		"sonar/max-switch-cases": "off",
		"sonar/no-nested-conditional": "off",
		"sonar/no-useless-catch": "off",
		"sonar/no-commented-code": "off",

		// --- TypeScript ergonomics --------------------------------------------------------
		"@typescript-eslint/no-explicit-any": "off",
		"ts/explicit-function-return-type": "off",
		"ts/explicit-member-accessibility": "off",
		"ts/no-empty-object-type": "off",
		"ts/no-floating-promises": "off",
		"ts/no-non-null-assertion": "off",
		"ts/no-shadow": "off",
		"ts/no-this-alias": "off",
		"ts/no-unnecessary-condition": "off",
		"ts/no-unnecessary-type-parameters": "off",
		"ts/no-useless-constructor": "off",
		"ts/prefer-nullish-coalescing": "off",
		"ts/prefer-optional-chain": "off",
		"ts/strict-boolean-expressions": "off",
		"ts/no-unnecessary-type-assertion": "off",
		"ts/no-require-imports": "off",
		"ts/no-empty-function": "off",
		"ts/array-type": "off",

		// --- Utility library adjustments --------------------------------------------------
		"unicorn/consistent-destructuring": "off",
		"unicorn/no-keyword-prefix": "off",
		"unicorn/no-array-for-each": "off",
		"unicorn/prevent-abbreviations": "off",
		"unicorn/prefer-default-parameters": "off",
		"no-lonely-if": "off",
		"no-restricted-syntax": "off",
		"no-useless-catch": "off",
		"shopify/prefer-module-scope-constants": "off",
		"shopify/prefer-early-return": "off",

		// --- Roblox specific allowances ---------------------------------------------------
		"roblox/misleading-lua-tuple-checks": "off",
		"roblox-ts/no-any": "off",
		"roblox/no-any": "off",
		"unused-imports/no-unused-vars": "off",
		"unused-imports/no-unused-imports": "off",
		"perfectionist/sort-objects": [
			"error",
			{
				customGroups: {
					id: "^id$",
					name: "^name$",
					callbacks: ["\\b(on[A-Z][a-zA-Z]*)\\b"],
				},
				groups: ["id", "name", "unknown"],
				order: "asc",
				partitionByComment: "^Part:\\*\\*(.*)$",
				type: "natural",
			},
		],
	},
	type: "game",
});
