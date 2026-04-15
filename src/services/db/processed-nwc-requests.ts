import { RepositoryError } from "@/domain/errors"
import { parseRepositoryError } from "@/services/db"
import type { ProcessedNwcRequestRecord } from "@/services/db/index.types"
import { queryBuilder } from "@/services/db/query-builder"
import { wrapAsyncFunctionsToRunInSpan } from "@/services/tracing"

const TABLE_NAME = "nwc_processed_requests"

export const ProcessedNwcRequestsRepository = () => {
  const isProcessed = async (eventId: string): Promise<boolean | RepositoryError> => {
    try {
      const doc = await queryBuilder<ProcessedNwcRequestRecord>(TABLE_NAME)
        .where({ event_id: eventId })
        .where("expires_at", ">", queryBuilder.fn.now() as any)
        .first()

      return !!doc
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const markProcessed = async (
    eventId: string,
    expiresAt: Date,
  ): Promise<void | RepositoryError> => {
    try {
      await queryBuilder<ProcessedNwcRequestRecord>(TABLE_NAME)
        .insert({
          event_id: eventId,
          processed_at: queryBuilder.fn.now() as any,
          expires_at: expiresAt,
        })
        .onConflict("event_id")
        .merge({
          processed_at: queryBuilder.fn.now() as any,
          expires_at: expiresAt,
        })
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const pruneExpired = async (): Promise<number | RepositoryError> => {
    try {
      return await queryBuilder<ProcessedNwcRequestRecord>(TABLE_NAME)
        .where("expires_at", "<=", queryBuilder.fn.now() as any)
        .delete()
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  return wrapAsyncFunctionsToRunInSpan({
    namespace: "services.db.processedNwcRequests",
    fns: {
      isProcessed,
      markProcessed,
      pruneExpired,
    },
  })
}
