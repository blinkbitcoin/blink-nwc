import { CustomApolloError, UnknownGraphqlError } from "./errors"

import { baseLogger } from "@/services/logger"

export const mapError = (error: Error): CustomApolloError => {
  // TODO: Add your custom error mapping here
  return new UnknownGraphqlError({
    message: error.message || "An unknown error occurred",
    logger: baseLogger,
  })
}
