const swcConfig = require("../swc-config.json")

module.exports = {
  moduleFileExtensions: ["js", "json", "ts", "cjs", "mjs"],
  rootDir: "../../",
  roots: ["<rootDir>/test/integration"],
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest", swcConfig],
  },
  setupFiles: ["<rootDir>/test/setup-env.ts"],
  testTimeout: 30000,
  testRegex: ".*\\.spec\\.ts$",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^test/(.*)$": ["<rootDir>test/$1"],
  },
}
