'use strict';

/**
 * ESLint rule: no-tiny-fontsize
 *
 * Flags any `fontSize` Property whose value is a numeric literal < 16.
 * Text must be at least fontSize: 16 to meet the readability standard.
 * For deliberate non-text exceptions (e.g. icon glyphs), use an
 * `// eslint-disable-next-line local/no-tiny-fontsize` with a short reason.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Text fontSize must be >= 16 (readability standard). eslint-disable for deliberate non-text exceptions like icon glyphs.',
    },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        if (
          node.key &&
          ((node.key.type === 'Identifier' && node.key.name === 'fontSize') ||
            (node.key.type === 'Literal' && node.key.value === 'fontSize')) &&
          node.value.type === 'Literal' &&
          typeof node.value.value === 'number' &&
          node.value.value < 16
        ) {
          context.report({
            node,
            message: `fontSize ${node.value.value} is below the 16px readability floor — bump to >= 16 or eslint-disable for a deliberate non-text size.`,
          });
        }
      },
    };
  },
};
