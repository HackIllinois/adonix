/* eslint-env node */
module.exports = {
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended-type-checked'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    ignorePatterns: ["temp.js", "**/devdocs/**", "**/apidocs/**"],
    parserOptions: {
        project: true,
        tsconfigRootDir: __dirname
    },
    root: true,
    rules: {
        "@typescript-eslint/typedef": ["error",
            {
                "arrowParameter": true,
                "variableDeclaration": true,
                "memberVariableDeclaration": true,
                "parameter": true,
                "propertyDeclaration": true
            }
        ],
        "@typescript-eslint/no-misused-promises": ["error",
            {
                "checksVoidReturn": false
            }
        ],
        "@typescript-eslint/explicit-function-return-type": "error",
        "@typescript-eslint/no-unsafe-argument": "error",
        "@typescript-eslint/no-explicit-any": "error",
        "linebreak-style": ["error", "unix"],
        "consistent-return": ["error"],
        // Suggestions
        "arrow-body-style": ["error", "always"],
        "curly": ["error", "all"],
        "no-lonely-if": ["error"],
        "no-magic-numbers": ["error", { "ignoreClassFieldInitialValues": true }],
        "no-multi-assign": ["error"],
        "no-nested-ternary": ["error"],
        "no-var": ["error"],
        "prefer-const": ["error"],
        "strict": ["error", "global"],
        "yoda": ["error", "never"],
        // Layout & Formatting
        "array-bracket-spacing": ["error", "always", { "singleValue": false }],
        "arrow-parens": ["error", "always"],
        "block-spacing": ["error", "always"],
        "brace-style": ["error", "1tbs"],
        "comma-dangle": ["error", "always-multiline"],
        "comma-style": ["error", "last"],
        "eol-last": ["error", "always"],
        "func-call-spacing": ["error", "never"],
        "indent": ["error", "tab"],
        "key-spacing": ["error", { "beforeColon": false, "afterColon": true }],
        "keyword-spacing": ["error", { "before": true, "after": true }],
        "line-comment-position": ["error", { "position": "above" }],
        "new-parens": ["error", "always"],
        "no-multi-spaces": ["error"],
        "no-trailing-spaces": ["error", { "skipBlankLines": true, "ignoreComments": false }],
        "object-curly-spacing": ["error", "always"],
        "quotes": ["error", "double"],
        "semi": ["error", "always"],
    }
}
