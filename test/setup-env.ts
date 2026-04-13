import fs from "fs"
import path from "path"

const defaultsPath = path.join(__dirname, "test-env.defaults")
const defaults = fs.readFileSync(defaultsPath, "utf8")

for (const line of defaults.split("\n")) {
  const trimmedLine = line.trim()
  if (!trimmedLine || trimmedLine.startsWith("#")) continue

  const separatorIndex = trimmedLine.indexOf("=")
  if (separatorIndex === -1) continue

  const key = trimmedLine.slice(0, separatorIndex).trim()
  const value = trimmedLine.slice(separatorIndex + 1).trim()

  process.env[key] ??= value
}
