const swcConfig = require("../swc-config.json")

module.exports = {
  moduleFileExtensions: ["js", "json", "ts", "cjs", "mjs"],
  rootDir: "../../",
  roots: ["<rootDir>/test/integration"],
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest", swcConfig],
  },
  testTimeout: 30000,
  testRegex: ".*\\.spec\\.ts$",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@config$": ["<rootDir>src/config/index"],
    "^@app$": ["<rootDir>src/app/index"],

    "^@config/(.*)$": ["<rootDir>src/config/$1"],
    "^@app/(.*)$": ["<rootDir>src/app/$1"],
    "^@domain/(.*)$": ["<rootDir>src/domain/$1"],
    "^@services/(.*)$": ["<rootDir>src/services/$1"],
    "^@servers/(.*)$": ["<rootDir>src/servers/$1"],
    "^@graphql/(.*)$": ["<rootDir>src/graphql/$1"],
    "^test/(.*)$": ["<rootDir>test/$1"],
  },
}
