import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import vueI18n from '@intlify/eslint-plugin-vue-i18n';

const tsProject = {
  projectService: true,
  ecmaVersion: 'latest',
  sourceType: 'module',
};

const tsTypeCheckedRules = tseslint.configs.recommendedTypeChecked
  .flatMap(c => c.rules ? [c.rules] : [])
  .reduce((acc, r) => Object.assign(acc, r), {});

export default [
  {
    ignores: [
      '**/*.{yml,yaml}',
      'node_modules/**',
      'dist/**',
      'dist-isolation/**',
      'src-isolation/**',
      'src-tauri/**',
      'test-results/**',
      'src/vite-env.d.ts',
      '.vite/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: tsProject,
    },
    ...tseslint.configs.recommendedTypeChecked[0],
  },
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ...tsProject,
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...tsTypeCheckedRules,
    },
  },
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: true,
    braceStyle: '1tbs',
  }),
  ...vueI18n.configs['flat/recommended'],
  {
    settings: {
      'vue-i18n': {
        localeDir: './src/locales/*.json',
        messageSyntaxVersion: '^11.0.0',
      },
    },
  },
];
