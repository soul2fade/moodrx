// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const noSmallFontsizeWithoutLineheight = require('./eslint-rules/no-small-fontsize-without-lineheight');

const localRulesPlugin = {
  rules: {
    'no-small-fontsize-without-lineheight': noSmallFontsizeWithoutLineheight,
  },
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    plugins: {
      local: localRulesPlugin,
    },
    rules: {
      'local/no-small-fontsize-without-lineheight': 'error',
    },
  },
]);
