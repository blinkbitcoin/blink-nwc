import {
  credentials,
  type CallOptions,
  type ClientReadableStream,
  type Metadata,
} from "@grpc/grpc-js"

import { BLINK_CORE_GRPC_HOST, BLINK_CORE_GRPC_PORT } from "@/config"
import { TransactionsStreamClient } from "@/services/core/grpc/proto/transactions_grpc_pb"
import {
  SubscribeTransactionsRequest,
  TransactionEvent,
} from "@/services/core/grpc/proto/transactions_pb"

export interface IBlinkCoreGrpcClient {
  subscribeTransactions(
    request: SubscribeTransactionsRequest,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): ClientReadableStream<TransactionEvent>
  waitForReady(deadline: Date): Promise<void>
  close(): void
}

type BlinkCoreGrpcClientConfig = {
  address?: string
}

const defaultAddress = () => `${BLINK_CORE_GRPC_HOST}:${BLINK_CORE_GRPC_PORT}`

export const BlinkCoreGrpcClient = ({
  address = defaultAddress(),
}: BlinkCoreGrpcClientConfig = {}): IBlinkCoreGrpcClient => {
  const client = new TransactionsStreamClient(address, credentials.createInsecure())

  return {
    subscribeTransactions: (
      request: SubscribeTransactionsRequest,
      metadata?: Metadata,
      options?: Partial<CallOptions>,
    ) =>
      metadata
        ? client.subscribeTransactions(request, metadata, options)
        : client.subscribeTransactions(request, options),
    waitForReady: (deadline: Date) =>
      new Promise<void>((resolve, reject) => {
        client.waitForReady(deadline, (error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      }),
    close: () => client.close(),
  }
}
