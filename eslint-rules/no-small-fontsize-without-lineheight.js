'use strict';

/**
 * ESLint rule: no-small-fontsize-without-lineheight
 *
 * Flags any object literal that sets fontSize <= 12 without also setting
 * lineHeight. This catches StyleSheet.create() blocks and inline style
 * objects before they ship, preventing text-clipping regressions on small
 * labels.
 *
 * Why <= 12? Tasks #37 and #38 manually patched all fontSize <= 12 entries
 * that were clipping. This rule prevents the pattern from re-appearing.
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require lineHeight whenever fontSize is <= 12 to prevent text clipping',
      recommended: true,
    },
    messages: {
      missingLineHeight:
        'Style block sets fontSize={{ fontSize }} (<=12) but has no lineHeight. ' +
        'Add an explicit lineHeight to prevent text clipping on Android/iOS.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxFontSize: { type: 'number' },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const MAX_FONT_SIZE = options.maxFontSize !== undefined ? options.maxFontSize : 12;

    function checkObjectExpression(node) {
      const props = node.properties;
      if (!Array.isArray(props)) return;

      let fontSizeValue = null;
      let hasLineHeight = false;

      for (const prop of props) {
        if (prop.type !== 'Property') continue;
        const keyName =
          prop.key.type === 'Identifier' ? prop.key.name :
          prop.key.type === 'Literal'    ? String(prop.key.value) :
          null;

        if (keyName === 'fontSize' && prop.value.type === 'Literal' && typeof prop.value.value === 'number') {
          fontSizeValue = prop.value.value;
        }
        if (keyName === 'lineHeight') {
          hasLineHeight = true;
        }
      }

      if (fontSizeValue !== null && fontSizeValue <= MAX_FONT_SIZE && !hasLineHeight) {
        context.report({
          node,
          messageId: 'missingLineHeight',
          data: { fontSize: fontSizeValue },
        });
      }
    }

    return {
      ObjectExpression: checkObjectExpression,
    };
  },
};
