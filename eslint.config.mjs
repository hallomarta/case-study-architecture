import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';

export default defineConfig(
    {
        ignores: ['dist/**', 'node_modules/**'],
    },
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module',
            },
        },
        rules: {
            'no-inferrable-types': 0,
            'space-before-function-paren': 0,
            'semi': 0,
            'padded-blocks': 0,
            'indent': ['error', 4],
            '@typescript-eslint/ban-types': 0,
            '@typescript-eslint/no-inferrable-types': 0,
            '@typescript-eslint/no-explicit-any': 0,
            '@typescript-eslint/explicit-module-boundary-types': 0,
            '@typescript-eslint/no-non-null-assertion': 0,
        },
    },
    {
        files: ['**/*.test.ts', '**/*.spec.ts'],
        plugins: {
            jest,
        },
        languageOptions: {
            globals: {
                ...jest.environments.globals.globals,
            },
        },
        rules: {
            ...jest.configs.recommended.rules,
        },
    }
);
