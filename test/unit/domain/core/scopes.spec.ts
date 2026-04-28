import { ScopesOauth2 } from "@/domain/core/scopes"

describe("ScopesOauth2", () => {
  it("exposes the supported oauth scopes", () => {
    expect(ScopesOauth2).toEqual({
      Read: "read",
      Write: "write",
      Receive: "receive",
    })
  })
})
