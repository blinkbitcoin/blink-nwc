import { status, type ServiceError } from "@grpc/grpc-js"

import { parseErrorFromUnknown, RepositoryError } from "@/domain/errors"
import {
  StreamCursorsRepository,
  type IStreamCursorsRepository,
} from "@/services/db/stream-cursors"
import { baseLogger } from "@/services/logger"
import { type NwcMonitoringServiceLike } from "@/services/nwc-monitoring"
import {
  BlinkCoreGrpcClient,
  type IBlinkCoreGrpcClient,
} from "@/services/core/grpc/grpc-client"
import {
  FibonacciBackoff,
  streamBuilder,
  type Stream,
} from "@/services/core/grpc/stream-client"
import {
  SubscribeTransactionsRequest,
  TransactionEvent,
} from "@/services/core/grpc/proto/transactions_pb"

const STREAM_NAME = "transactions"
const CHANNEL_READY_TIMEOUT_MS = 5_000

type TransactionHandler = (event: TransactionEvent) => Promise<void>

type TransactionSubscriberConfig = {
  client?: IBlinkCoreGrpcClient
  cursorsRepository?: IStreamCursorsRepository
  logger?: Logger
  streamName?: string
  backoff?: BaseBackOff
  monitoring?: NwcMonitoringServiceLike
  channelReadyTimeoutMs?: number
}

type TransactionStream = Stream<TransactionEvent, SubscribeTransactionsRequest>

const setRequestCursor = (
  request: SubscribeTransactionsRequest,
  cursor: string | null,
) => {
  if (cursor) {
    request.setAfterTransactionId(cursor)
    return
  }

  if (request.hasAfterTransactionId()) {
    request.clearAfterTransactionId()
  }
}

export const TransactionSubscriber = ({
  client = BlinkCoreGrpcClient(),
  cursorsRepository = StreamCursorsRepository(),
  logger = baseLogger.child({ module: "transaction-subscriber" }),
  streamName = STREAM_NAME,
  backoff = new FibonacciBackoff(500, 8),
  monitoring,
  channelReadyTimeoutMs = CHANNEL_READY_TIMEOUT_MS,
}: TransactionSubscriberConfig = {}) => {
  const subscribe = async (handle: TransactionHandler): Promise<() => Promise<void>> => {
    let isRunning = true
    // Assigned once after callbacks are registered so stop() can close the active stream.
    // eslint-disable-next-line prefer-const
    let activeStream: TransactionStream | undefined

    const initialCursor = await cursorsRepository.get(streamName)
    if (initialCursor instanceof RepositoryError) {
      throw initialCursor
    }

    let persistedCursor = initialCursor
    const request = new SubscribeTransactionsRequest()
    setRequestCursor(request, persistedCursor)
    monitoring?.markTransactionStreamDisconnected()

    const markChannelReadyWhenReady = () => {
      client
        .waitForReady(new Date(Date.now() + channelReadyTimeoutMs))
        .then(() => {
          if (isRunning) {
            monitoring?.markTransactionStreamConnected()
          }
        })
        .catch((error) => {
          if (!isRunning) {
            return
          }

          logger.warn(
            {
              err: parseErrorFromUnknown(error),
              afterTransactionId: persistedCursor,
            },
            "transaction stream channel not ready",
          )
        })
    }

    const stop = async () => {
      if (!isRunning) {
        return
      }

      isRunning = false
      monitoring?.markTransactionStreamDisconnected()
      activeStream?.cancel()
      client.close()
      logger.info("transaction subscriber stopped")
    }

    const resetRequestCursor = () => setRequestCursor(request, persistedCursor)

    const reconnectWithPersistedCursor = (
      stream: TransactionStream,
      error: unknown,
      event?: TransactionEvent,
    ) => {
      resetRequestCursor()
      monitoring?.markTransactionStreamDisconnected()

      logger.error(
        {
          err: parseErrorFromUnknown(error),
          afterTransactionId: persistedCursor,
          ledgerTransactionId: event?.getLedgerTransactionId(),
        },
        "failed to process transaction event",
      )

      stream.cancel()
      stream.reconnect()
    }

    const processTransactionEvent = async (
      stream: TransactionStream,
      event: TransactionEvent,
    ) => {
      const transport = stream.stream
      let shouldResume = true

      transport?.pause()

      try {
        monitoring?.markTransactionStreamConnected()
        monitoring?.recordTransactionStreamReplayLagFromTimestamp(event.getTimestamp())
        const nextCursor = event.getLedgerTransactionId()
        if (!nextCursor) {
          throw new Error("Missing ledger transaction id in transaction event")
        }

        await handle(event)

        const saveResult = await cursorsRepository.set(streamName, nextCursor)
        if (saveResult instanceof RepositoryError) {
          throw saveResult
        }

        persistedCursor = nextCursor
        request.setAfterTransactionId(nextCursor)
      } catch (error) {
        shouldResume = false
        reconnectWithPersistedCursor(stream, error, event)
      } finally {
        if (shouldResume && transport && stream.stream === transport && isRunning) {
          transport.resume()
        }
      }
    }

    const onStreamError = async (stream: TransactionStream, error: ServiceError) => {
      if (!isRunning) {
        return
      }

      if (error.code === status.INVALID_ARGUMENT) {
        logger.error(
          {
            error,
            afterTransactionId: persistedCursor,
          },
          "invalid stored transaction cursor, stopping subscriber",
        )
        await stop()
        return
      }

      resetRequestCursor()
      monitoring?.markTransactionStreamDisconnected()
      logger.warn(
        {
          error,
          afterTransactionId: persistedCursor,
        },
        "transaction stream disconnected",
      )
    }

    const onStreamEnd = () => {
      if (!isRunning) {
        return
      }

      resetRequestCursor()
      monitoring?.markTransactionStreamDisconnected()
      logger.warn(
        {
          afterTransactionId: persistedCursor,
        },
        "transaction stream ended",
      )
    }

    activeStream = streamBuilder<TransactionEvent, SubscribeTransactionsRequest>(
      client.subscribeTransactions as StreamMethod<TransactionEvent>,
    )
      .withOptions({ retry: true, acceptDataOnReconnect: false })
      .withRequest(request)
      .withBackoff(backoff)
      .onMetadata(() => {
        monitoring?.markTransactionStreamConnected()
      })
      .onData((stream, event) => {
        processTransactionEvent(stream, event).catch((error) => {
          logger.error(
            { err: parseErrorFromUnknown(error) },
            "unexpected transaction event processing failure",
          )
        })
      })
      .onError((stream, error) => {
        onStreamError(stream, error).catch((handlerError) => {
          logger.error(
            { err: parseErrorFromUnknown(handlerError) },
            "unexpected transaction stream error handler failure",
          )
        })
      })
      .onEnd(onStreamEnd)
      .onRetry((_, { detail }) => {
        monitoring?.recordTransactionStreamReconnect()
        markChannelReadyWhenReady()
        logger.info(
          {
            afterTransactionId: persistedCursor,
            retries: detail.retries,
            backoff: detail.backoff,
          },
          "retrying transaction stream",
        )
      })
      .build()

    markChannelReadyWhenReady()

    logger.info(
      {
        afterTransactionId: persistedCursor,
      },
      "transaction subscriber started",
    )

    return stop
  }

  return { subscribe }
}
