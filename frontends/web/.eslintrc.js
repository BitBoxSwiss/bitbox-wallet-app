module.exports = {
  "env": {
    "browser": true
  },
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    // "eslint:recommended",
    // "plugin:@typescript-eslint/eslint-recommended",
    // "plugin:@typescript-eslint/recommended",
    // "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": "8",
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    },
    "project": require.resolve("./tsconfig.json"),
  },
  "settings": {
    "react": {
        "pragma": "h",
        "version": "16"
    },
  },
  "ignorePatterns": [
    "*.css.d.ts"
  ],
  "rules": {
    "react/display-name": [2, { ignoreTranspilerName: false }],
    "react/jsx-equals-spacing": 2,
    "react/jsx-no-comment-textnodes": 2,
    "react/jsx-no-duplicate-props": 2,
    "react/jsx-no-target-blank": 2,
    "react/jsx-no-undef": 2,
    "react/jsx-pascal-case": 2,
    "react/jsx-uses-react": 2,
    "react/jsx-uses-vars": 2,
    "react/jsx-wrap-multilines": 2,
    "react/no-danger": 2,
    "react/no-did-mount-set-state": 2,
    "react/no-did-update-set-state": 2,
    "react/no-find-dom-node": 2,
    "react/no-is-mounted": 2,
    "react/no-string-refs": 0,
    "react/prefer-es6-class": 2,
    "react/prefer-stateless-function": 1,
    "react/require-render-return": 2,

    "no-eval": 2,
    "no-implied-eval": 2,
    "no-new-func": 2,

    "arrow-parens": [0, "always"],
    "arrow-spacing": 2,
    camelcase: [1, { properties: "never" }],
    "comma-style": [2, "last"],
    "constructor-super": 2,
    curly: [0, "multi-line"],
    "dot-notation": [2, { allowPattern: "^[a-z]+(_[a-z]+)+$" }],
    eqeqeq: 2,
    "func-style": [2, "declaration", { allowArrowFunctions: true }],
    "guard-for-in": 2,
    "handle-callback-err": 0,
    "jsx-quotes": [2, "prefer-double"],
    "key-spacing": 2,
    "keyword-spacing": 2,
    "lines-around-comment": 2,
    "new-cap": 1,
    "new-parens": 2,
    "no-array-constructor": 2,
    "no-caller": 2,
    "no-cond-assign": 2,
    "no-console": [1, { allow: ["warn", "error"] }],
    "no-const-assign": 2,
    "no-delete-var": 2,
    "no-dupe-class-members": 2,
    "no-dupe-keys": 2,
    "no-duplicate-imports": 2,
    "no-else-return": 2,
    "no-empty-pattern": 0,
    "no-empty": 0,
    "no-extra-parens": 0,			// we use extra parens in JSX ternaries, no way to disable that here.
    "no-iterator": 2,
    "no-lonely-if": 2,
    "no-mixed-spaces-and-tabs": [2, "smart-tabs"],
    "no-multi-str": 2,
    "no-multiple-empty-lines": [2, { max: 2 }],
    "no-new-wrappers": 2,
    "no-proto": 2,
    "no-redeclare": 2,
    "no-restricted-globals": [2, "find", "Text"],
    "no-shadow-restricted-names": 2,
    "no-shadow": 0,
    "no-spaced-func": 2,
    "no-this-before-super": 2,
    "no-trailing-spaces": [2, { skipBlankLines: true }],
    "no-undef-init": 2,
    "no-unneeded-ternary": 2,
    "no-unused-vars": [2, { args: "none", varsIgnorePattern: "^h$" }],
    "no-useless-call": 2,
    "no-useless-computed-key": 2,
    "no-useless-concat": 2,
    "no-useless-constructor": 2,
    "no-useless-escape": 2,
    "no-useless-rename": 2,
    "no-var": 2,
    "no-with": 2,
    "object-shorthand": 2,
    "prefer-arrow-callback": 2,
    "prefer-rest-params": 2,
    "prefer-spread": 2,
    "prefer-template": 0,			// we can enable this when they add an option to allow concat for complex variables
    // "quote-props": [2, "as-needed"],
    radix: 2,
    "rest-spread-spacing": 2,
    semi: 2,
    "space-before-function-paren": [0, "always"],		// for fmt
    "space-in-parens": [0, "never"],
    strict: [2, "never"],
    "unicode-bom": 2,
	  "valid-jsdoc": [0, { requireReturn: false }], // no way to turn this off for pure functional component
    
    // Shift
    "no-alert": "off",
    "arrow-body-style": [0, "as-needed"],
    // temp disable
    //"brace-style": [1, "1tbs"],
    "brace-style": "off",
    "comma-dangle": 0,
    // temp disable
    // "indent": ["warn", 4, {
    //   "SwitchCase": 1
    // }],
    "indent": "off",
    "quotes": ["warn", "single", {
      "avoidEscape": true,
      "allowTemplateLiterals": true
    }],
    "quote-props": ["warn", "as-needed"],
    "react/self-closing-comp": 0,
    "react/jsx-curly-spacing": 0,
    "react/jsx-indent-props": ["warn", 4],
    "react/sort-comp": 0,
    "react/jsx-boolean-value": 0,
    "react/jsx-closing-bracket-location": 0,
    "react/jsx-max-props-per-line": ["warn", { "maximum": 5, "when": "always" }],
    "react/jsx-tag-spacing": ["warn"],
    "react/jsx-no-bind": "off",
    "react/jsx-key": ["error"],

    "object-curly-spacing": "off",
  },
  overrides: [
    {
      files: ["*.jsx"],
      rules: {
        "react/prop-types": "off"
      }
    }
  ]
};
