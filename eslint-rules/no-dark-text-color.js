'use strict';

const DARK_HEX_RE = /^#([0-9a-fA-F]{3,6})$/;

function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function hexBrightness(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return Math.round((rgb.r + rgb.g + rgb.b) / 3);
}

function isNearGrayscale(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return false;
  const spread = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
  return spread < 40;
}

const TEXT_COLOR_PROPS = new Set(['color']);
const MIN_BRIGHTNESS = 0x88;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Warn when a text `color` property uses a hex color darker than #888 on a dark background.',
    },
    messages: {
      darkTextColor:
        'Text color "{{ color }}" is darker than #888 (brightness {{ brightness }}). ' +
        'Use at least #999 for readable text on dark backgrounds.',
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
        if (!TEXT_COLOR_PROPS.has(keyName)) continue;
        if (prop.value.type !== 'Literal' || typeof prop.value.value !== 'string') continue;

        const color = prop.value.value;
        if (!DARK_HEX_RE.test(color)) continue;

        const brightness = hexBrightness(color);
        if (brightness !== null && brightness < MIN_BRIGHTNESS && isNearGrayscale(color)) {
          context.report({
            node: prop.value,
            messageId: 'darkTextColor',
            data: { color, brightness },
          });
        }
      }
    }

    return {
      ObjectExpression: checkObjectExpression,
    };
  },
};
