// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const noSmallFontsizeWithoutLineheight = require('./eslint-rules/no-small-fontsize-without-lineheight');
const noFontSizeBelow12 = require('./eslint-rules/no-fontSize-below-12');
const noDarkTextColor = require('./eslint-rules/no-dark-text-color');

const localRulesPlugin = {
  rules: {
    'no-small-fontsize-without-lineheight': noSmallFontsizeWithoutLineheight,
    'no-fontSize-below-12': noFontSizeBelow12,
    'no-dark-text-color': noDarkTextColor,
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
      'local/no-fontSize-below-12': 'error',
      'local/no-dark-text-color': 'warn',
    },
  },
]);
