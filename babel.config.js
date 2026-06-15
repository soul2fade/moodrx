module.exports = function (api) {
  api.cache(true);

  // Add custom babel plugins in the babel.plugins.js file
  const buildAdditionalPlugins = require("./babel.plugins");

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
        },
      ],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],

          alias: {
            "@": "./",
            "tailwind.config": "./tailwind.config.js",
          },
        },
      ],
      ...buildAdditionalPlugins(api),
      "react-native-worklets/plugin", // Must be last
    ],
  };
};
