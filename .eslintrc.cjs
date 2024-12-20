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
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }], // Allow prefixing unused args with _ to ignore error
        "@typescript-eslint/no-misused-promises": [
            "error",
            {
                checksVoidReturn: false,
            },
        ],
        "@typescript-eslint/explicit-function-return-type": "error",
        "@typescript-eslint/no-unsafe-argument": "error",
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-inferrable-types": ["error", { ignoreParameters: true, ignoreProperties: true }],
        "arrow-body-style": ["error", "as-needed"],
        curly: ["error", "all"],
        "consistent-return": "error",
        "no-lonely-if": "error",
        "no-magic-numbers": ["error", { ignoreClassFieldInitialValues: true, ignore: [0, 1, 2] }],
        "no-multi-assign": "error",
        "no-nested-ternary": "error",
        "no-var": "error",
        "prefer-const": "error",
        strict: ["error", "global"],
        yoda: ["error", "never"],
    },
    overrides: [
        {
            files: ["**/*.test.ts", "**/mocks/*.ts"], // Disable specific rules for tests
            rules: {
                "no-magic-numbers": "off",
                "@typescript-eslint/no-var-requires": "off", // Required for jest
            },
        },
        {
            files: ["src/common/config.ts"], // Disable specific rules for config
            rules: {
                "no-magic-numbers": "off",
            },
        },
    ],
};
