import { GraphQLError } from "graphql"

import { baseLogger } from "@/services/logger"

export class CustomGraphQLError extends GraphQLError {
  log: LogFn
  forwardToClient: boolean

  constructor({
    message,
    code,
    forwardToClient,
    logger,
    level,
    ...metadata
  }: CustomGraphQLErrorData & { code: string }) {
    const options = { ...metadata }
    options["extensions"] = { ...(options["extensions"] || {}), code }
    super(message ?? code, options)
    this.log = logger[level || "warn"].bind(logger)
    this.forwardToClient = forwardToClient || false
  }
}

export class OperationRestrictedError extends CustomGraphQLError {
  constructor(errData: CustomGraphQLErrorData) {
    super({ code: "OPERATION_RESTRICTED", forwardToClient: true, ...errData })
  }
}

export class UnknownClientError extends CustomGraphQLError {
  constructor(errData: CustomGraphQLErrorData) {
    super({ code: "UNKNOWN_CLIENT_ERROR", forwardToClient: true, ...errData })
  }
}

export class InputValidationError extends CustomGraphQLError {
  constructor(errData: PartialBy<CustomGraphQLErrorData, "logger" | "forwardToClient">) {
    super({
      code: "INVALID_INPUT",
      forwardToClient: true,
      ...errData,
      logger: baseLogger,
    })
  }
}

export class NotFoundError extends CustomGraphQLError {
  constructor(errData: CustomGraphQLErrorData) {
    super({ code: "NOT_FOUND", forwardToClient: true, ...errData })
  }
}

export class UnexpectedClientError extends CustomGraphQLError {
  constructor(errData: CustomGraphQLErrorData) {
    super({ code: "UNEXPECTED_CLIENT_ERROR", forwardToClient: true, ...errData })
  }
}
