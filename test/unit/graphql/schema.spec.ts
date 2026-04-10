import { readFileSync } from "fs"
import path from "path"

const schemaPath = path.resolve(__dirname, "../../../src/graphql/schema.graphql")

describe("graphql schema", () => {
  it("does not expose unsupported budget fields in the NWC contract", () => {
    const schema = readFileSync(schemaPath, "utf8")

    expect(schema).not.toContain("budget: NwcBudget")
    expect(schema).not.toContain("budget: NwcBudgetInput")
    expect(schema).not.toContain("type NwcBudget")
    expect(schema).not.toContain("input NwcBudgetInput")
    expect(schema).not.toContain("enum NwcBudgetPeriod")
  })
})
