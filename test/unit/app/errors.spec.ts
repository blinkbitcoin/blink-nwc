import { ApplicationErrors } from "@/app/errors"
import { InvalidWalletId } from "@/domain/errors"
import { ExampleError } from "@/domain/example/errors"

describe("ApplicationErrors", () => {
  it("re-exports domain and example application errors", () => {
    expect(ApplicationErrors.InvalidWalletId).toBe(InvalidWalletId)
    expect(ApplicationErrors.ExampleError).toBe(ExampleError)
  })
})
