describe("env config", () => {
  const originalPrivateKey = process.env.NOSTR_PRIVATE_KEY

  afterEach(() => {
    jest.resetModules()
    process.env.NOSTR_PRIVATE_KEY = originalPrivateKey
  })

  it("fails startup validation when NOSTR_PRIVATE_KEY is missing", async () => {
    delete process.env.NOSTR_PRIVATE_KEY
    jest.resetModules()

    await expect(import("@/config/env")).rejects.toThrow(/NOSTR_PRIVATE_KEY/)
  })
})
