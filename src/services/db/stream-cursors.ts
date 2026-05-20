import { queryBuilder } from "@/services/db/query-builder"
import type { StreamCursorRecord } from "@/services/db/index.types"
import { parseRepositoryError } from "@/services/db/index"
import { RepositoryError } from "@/domain/errors"
import { wrapAsyncFunctionsToRunInSpan } from "@/services/tracing"

const TABLE_NAME = "stream_cursors"

export interface IStreamCursorsRepository {
  get(streamName: string): Promise<string | null | RepositoryError>
  set(streamName: string, cursorValue: string): Promise<void | RepositoryError>
}

export const StreamCursorsRepository = (): IStreamCursorsRepository =>
  wrapAsyncFunctionsToRunInSpan({
    namespace: "services.db.stream-cursors",
    fns: {
      get: async (streamName: string): Promise<string | null | RepositoryError> => {
        try {
          const record = await queryBuilder<StreamCursorRecord>(TABLE_NAME)
            .where({ stream_name: streamName })
            .first()

          return record?.cursor_value ?? null
        } catch (err) {
          return parseRepositoryError(err)
        }
      },

      set: async (
        streamName: string,
        cursorValue: string,
      ): Promise<void | RepositoryError> => {
        try {
          await queryBuilder<StreamCursorRecord>(TABLE_NAME)
            .insert({
              stream_name: streamName,
              cursor_value: cursorValue,
              updated_at: queryBuilder.fn.now(),
            })
            .onConflict("stream_name")
            .merge({
              cursor_value: cursorValue,
              updated_at: queryBuilder.fn.now(),
            })
        } catch (err) {
          return parseRepositoryError(err)
        }
      },
    },
  })
