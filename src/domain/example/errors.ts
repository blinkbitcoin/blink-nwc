import { DomainError, ErrorLevel } from "../errors"

export class ExampleError extends DomainError {}

export class UnknownExampleError extends ExampleError {
  level = ErrorLevel.Warn
}
