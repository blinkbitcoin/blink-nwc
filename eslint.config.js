const { FlatCompat } = require("@eslint/eslintrc")
const js = require("@eslint/js")
const path = require("node:path")

const ignores = [
  "lib",
  "coverage",
  "generated",
  "protos",
  "dist",
  "node_modules",
  "**/proto/**/*.js",
  "**/*.pb.js",
  "**/jest.config.js",
  "**/jest.setup.js",
]

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
})

module.exports = [
  {
    ignores,
  },
  ...compat.config({
    extends: ["./.eslintrc.js"],
  }),
]
