module.exports = {
    env: {
        es2021: true,
        node: true,
    },
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
    },
    plugins: ["@typescript-eslint"],
    rules: {
        "@typescript-eslint/no-misused-promises": [
            "error",
            {
                checksVoidReturn: false,
            },
        ],
        "@typescript-eslint/explicit-function-return-type": "error",
        "@typescript-eslint/no-unsafe-argument": "error",
        "@typescript-eslint/no-explicit-any": "error",
        "consistent-return": ["error"],
        // Suggestions
        "arrow-body-style": ["error", "always"],
        curly: ["error", "all"],
        "no-lonely-if": ["error"],
        "no-magic-numbers": ["error", { ignoreClassFieldInitialValues: true }],
        "no-multi-assign": ["error"],
        "no-nested-ternary": ["error"],
        "no-var": ["error"],
        "prefer-const": ["error"],
        strict: ["error", "global"],
        yoda: ["error", "never"],
    },
    overrides: [
        {
            files: ["**/*.test.ts"], // Disable specific rules for tests
            rules: {
                "no-magic-numbers": "off",
                "@typescript-eslint/no-var-requires": "off", // Required for jest
            },
        },
    ],
};
