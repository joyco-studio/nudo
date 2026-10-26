import eslint from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

const UI_FRAMEWORK_PACKAGES = ['react', 'react-dom', '@xyflow/*']
const THREE_PACKAGES = ['three', 'three/*']

/**
 * Builds a `no-restricted-imports` rule that forbids the given import patterns.
 * `allowedInternal` lists the `@nudo-tsl/*` packages the target package may import.
 */
const restrictImports = ({ packages, allowedInternal, reason }) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['@nudo-tsl/*', ...allowedInternal.map((name) => `!@nudo-tsl/${name}`)],
          message: reason.internal,
        },
        { group: packages, message: reason.external },
      ],
    },
  ],
})

export default defineConfig(
  globalIgnores(['**/dist/**', '**/.turbo/**', '**/coverage/**', '**/node_modules/**', 'docs/**']),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
  {
    // Plain JS tooling files (including this one) are not part of any tsconfig project.
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    name: 'boundaries/core',
    files: ['packages/core/**/*.{ts,tsx}'],
    rules: restrictImports({
      packages: [...UI_FRAMEWORK_PACKAGES, ...THREE_PACKAGES],
      allowedInternal: [],
      reason: {
        internal: '@nudo-tsl/core must not import any other workspace package.',
        external: '@nudo-tsl/core must not depend on react, react-dom, three or @xyflow/*.',
      },
    }),
  },
  {
    name: 'boundaries/nodes',
    files: ['packages/nodes/**/*.{ts,tsx}'],
    rules: restrictImports({
      packages: [...UI_FRAMEWORK_PACKAGES, ...THREE_PACKAGES],
      allowedInternal: ['core'],
      reason: {
        internal: '@nudo-tsl/nodes may only import @nudo-tsl/core.',
        external: '@nudo-tsl/nodes must not depend on react, react-dom, three or @xyflow/*.',
      },
    }),
  },
  {
    name: 'boundaries/runtime',
    files: ['packages/runtime/**/*.{ts,tsx}'],
    rules: restrictImports({
      packages: UI_FRAMEWORK_PACKAGES,
      allowedInternal: ['core', 'nodes'],
      reason: {
        internal: '@nudo-tsl/runtime may only import @nudo-tsl/core and @nudo-tsl/nodes.',
        external: '@nudo-tsl/runtime must not depend on react, react-dom or @xyflow/*.',
      },
    }),
  },
  {
    // R5: vendored shadcn/joyco UI code is not held to the assertion and strict-type rules.
    name: 'vendored-ui',
    files: ['apps/editor/src/shared/ui/**'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
)
