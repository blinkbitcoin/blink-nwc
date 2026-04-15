import {
  parseErrorFromUnknown,
  parseErrorMessageFromUnknown,
} from "@/domain/error-parsers"

describe("domain error parsers", () => {
  it("extracts messages from supported error inputs", () => {
    expect(parseErrorMessageFromUnknown(new Error("boom"))).toBe("boom")
    expect(parseErrorMessageFromUnknown("oops")).toBe("oops")
    expect(parseErrorMessageFromUnknown({ reason: "bad" })).toBe(
      JSON.stringify({ reason: "bad" }),
    )
    expect(parseErrorMessageFromUnknown(undefined)).toBe("Unknown error")
  })

  it("normalizes unknown values into Error instances", () => {
    const original = new Error("boom")

    expect(parseErrorFromUnknown(original)).toBe(original)
    expect(parseErrorFromUnknown("oops")).toEqual(new Error("oops"))
    expect(parseErrorFromUnknown({ reason: "bad" })).toEqual(
      new Error(JSON.stringify({ reason: "bad" })),
    )
    expect(parseErrorFromUnknown(undefined)).toEqual(new Error("Unknown error"))
  })
})
