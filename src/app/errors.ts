import * as DomainErrors from "@/domain/errors"
import * as ExampleErrors from "@/domain/example/errors"

export const ApplicationErrors = {
  ...DomainErrors,
  ...ExampleErrors,
} as const
