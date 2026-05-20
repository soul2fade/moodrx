'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow fontSize values below 12 in style objects and StyleSheet definitions.',
    },
    messages: {
      fontSizeTooSmall:
        'fontSize {{ value }} is below the minimum of 12. All text must be at least fontSize: 12.',
    },
    schema: [],
  },

  create(context) {
    function checkObjectExpression(node) {
      const props = node.properties;
      if (!Array.isArray(props)) return;

      for (const prop of props) {
        if (prop.type !== 'Property') continue;
        const keyName =
          prop.key.type === 'Identifier' ? prop.key.name :
          prop.key.type === 'Literal'    ? String(prop.key.value) :
          null;
        if (keyName === 'fontSize' && prop.value.type === 'Literal' && typeof prop.value.value === 'number') {
          if (prop.value.value < 12) {
            context.report({
              node: prop.value,
              messageId: 'fontSizeTooSmall',
              data: { value: prop.value.value },
            });
          }
        }
      }
    }

    return {
      ObjectExpression: checkObjectExpression,
    };
  },
};
