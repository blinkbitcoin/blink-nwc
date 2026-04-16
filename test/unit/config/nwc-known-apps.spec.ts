describe("known app config", () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    jest.resetModules()

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
      return
    }

    process.env.NODE_ENV = originalNodeEnv
  })

  it("fails startup in production when a known app uses a placeholder pubkey", async () => {
    process.env.NODE_ENV = "production"
    jest.resetModules()

    await expect(import("@/config/nwc-known-apps")).rejects.toThrow(/placeholder pubkey/)
  })

  it("returns null when known app lookup receives a malformed pubkey", async () => {
    process.env.NODE_ENV = "test"
    jest.resetModules()

    const { findKnownAppByPubkey } = await import("@/config/nwc-known-apps")

    expect(findKnownAppByPubkey("not-a-pubkey")).toBeNull()
    expect(findKnownAppByPubkey("a".repeat(63))).toBeNull()
    expect(findKnownAppByPubkey("f".repeat(64))).toBeNull()
  })

  it("loads structurally valid known apps in non-production environments", async () => {
    process.env.NODE_ENV = "test"
    jest.resetModules()

    const { NWC_KNOWN_APPS } = await import("@/config/nwc-known-apps")

    expect(NWC_KNOWN_APPS).not.toHaveLength(0)
    expect(NWC_KNOWN_APPS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pubkey: expect.stringMatching(/^[0-9a-f]{64}$/),
          name: expect.any(String),
          description: expect.any(String),
          recommendedPreset: expect.objectContaining({
            id: expect.any(String),
            permissions: expect.any(Array),
          }),
        }),
      ]),
    )
  })
})
