import playcanvas from '@playcanvas/eslint-config';
import tseslint from 'typescript-eslint';

export default [
    ...playcanvas,
    ...tseslint.configs.recommended,
    {
        ignores: [
            '.quake-data/**',
            '.reference/**',
            'artifacts/**',
            'coverage/**',
            'dist/**',
            'node_modules/**',
            'playwright-report/**',
            'test-results/**'
        ]
    },
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            globals: {
                console: 'readonly',
                crypto: 'readonly',
                document: 'readonly',
                fetch: 'readonly',
                ImageData: 'readonly',
                TextDecoder: 'readonly',
                URLSearchParams: 'readonly',
                window: 'readonly'
            }
        }
    },
    {
        files: ['scripts/**/*.mjs', 'tests/**/*.ts', 'vite.config.ts'],
        languageOptions: {
            globals: {
                Buffer: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                process: 'readonly',
                TextDecoder: 'readonly'
            }
        }
    },
    {
        files: ['src/**/*.ts', 'tests/**/*.ts', 'vite.config.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
            'import/extensions': 'off',
            'import/no-unresolved': 'off',
            'lines-between-class-members': 'off',
            'no-unused-vars': 'off'
        }
    },
    {
        files: ['eslint.config.js', 'vite.config.ts'],
        rules: {
            'import/no-unresolved': 'off'
        }
    }
];
