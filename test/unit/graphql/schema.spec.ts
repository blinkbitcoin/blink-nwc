import { readFileSync } from "fs"
import path from "path"

import { SUPPORTED_NWC_METHODS } from "@/config"
import { Nip47Method } from "@/domain/nostr"

const schemaPath = path.resolve(__dirname, "../../../src/graphql/schema.graphql")

describe("graphql schema", () => {
  it("exposes the architecture budget and permission types in the NWC contract", () => {
    const schema = readFileSync(schemaPath, "utf8")

    expect(schema).toContain("budgets: [NwcBudget!]!")
    expect(schema).toContain("budgets: [NwcBudgetInput!]")
    expect(schema).not.toMatch(/\bbudget: NwcBudget\b/)
    expect(schema).not.toMatch(/\bbudget: NwcBudgetInput\b/)
    expect(schema).toContain("type NwcBudget")
    expect(schema).toContain("input NwcBudgetInput")
    expect(schema).toContain("enum NwcBudgetPeriod")
    expect(schema).toContain("enum NwcPermission")
  })

  it("matches the documented root query and connection update contract", () => {
    const schema = readFileSync(schemaPath, "utf8")

    expect(schema).toContain("nwcConnection(id: ID!): NwcConnection")
    expect(schema).toContain("nwcConnections(includeRevoked: Boolean = false)")
    expect(schema).toContain("nwcPermissionPresets: [NwcPermissionPreset!]!")
    expect(schema).toContain("nwcKnownApp(pubkey: String!): NwcKnownApp")
    expect(schema).toContain("connectionId: ID!")
    expect(schema).toMatch(
      /input NwcConnectionUpdateInput\s*\{[\s\S]*connectionId: ID![\s\S]*budgets: \[NwcBudgetInput!\][\s\S]*\}/,
    )
    expect(schema).not.toMatch(
      /input NwcConnectionUpdateInput\s*\{[\s\S]*permissions: \[NwcPermission!\][\s\S]*\}/,
    )
  })

  it("removes client-supplied API key fields from connection creation", () => {
    const schema = readFileSync(schemaPath, "utf8")

    expect(schema).toContain("nwcUri: String!")
    expect(schema).not.toContain("apiKey: String!")
    expect(schema).not.toContain("apiKeyId: String")
    expect(schema).not.toContain("notificationsEnabled")
  })

  it("keeps the public Nip47Method enum aligned with supported methods", () => {
    expect(SUPPORTED_NWC_METHODS).toEqual(Object.values(Nip47Method))
  })

  it("exposes permission preset and known app metadata types", () => {
    const schema = readFileSync(schemaPath, "utf8")

    expect(schema).toContain("type NwcPermissionPreset")
    expect(schema).toContain("enum NwcPermissionPresetId")
    expect(schema).toContain("type NwcKnownApp")
    expect(schema).toContain("recommendedPreset: NwcPermissionPreset!")
  })
})
