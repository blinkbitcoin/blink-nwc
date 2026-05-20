import { ApplicationErrors } from "@/app/errors"
import { PartialResult } from "@/app/partial-result"
import { InvalidWalletId } from "@/domain/errors"
import { ExampleError } from "@/domain/example/errors"

describe("app helpers", () => {
  it("creates successful, partial, and failed partial results", () => {
    const error = new InvalidWalletId("bad wallet")

    expect(PartialResult.ok("value")).toEqual({
      result: "value",
      partialResult: true,
    })
    expect(PartialResult.partial("value", error)).toEqual({
      result: "value",
      error,
      partialResult: true,
    })
    expect(PartialResult.err<string>(error)).toEqual({
      result: null,
      error,
      partialResult: true,
    })
  })

  it("re-exports domain and example application errors", () => {
    expect(ApplicationErrors.InvalidWalletId).toBe(InvalidWalletId)
    expect(ApplicationErrors.ExampleError).toBe(ExampleError)
  })
})
