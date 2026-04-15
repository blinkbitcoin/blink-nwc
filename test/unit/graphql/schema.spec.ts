import { readFileSync } from "fs"
import path from "path"

import { SUPPORTED_NWC_METHODS } from "@/config"
import { Nip47Method } from "@/domain/nostr"

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

  it("keeps the public Nip47Method enum aligned with supported methods", () => {
    const schema = readFileSync(schemaPath, "utf8")

    expect(schema).not.toContain("GET_BUDGET")
    expect(SUPPORTED_NWC_METHODS).toEqual(Object.values(Nip47Method))
  })
})
