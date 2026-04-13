import {
  SUPPORTED_NWC_METHODS,
  SUPPORTED_NWC_NOTIFICATIONS,
  WALLET_ALIAS,
  WALLET_COLOR,
} from "@/config"
import { getServerKeypair } from "@/domain/connection"
import { NwcConnection, hasPermission } from "@/domain/connection"
import { ErrorLevel } from "@/domain/errors"
import { Nip47MethodType, Nip47Result, NwcServerAlias } from "@/domain/index.types"
import {
  Nip47Error,
  Nip47InternalError,
  Nip47NotImplementedError,
  Nip47RestrictedError,
} from "@/domain/nostr"
import { BlinkCoreService } from "@/services"
import { baseLogger } from "@/services/logger"
import {
  addAttributesToCurrentSpan,
  recordExceptionInCurrentSpan,
  wrapAsyncToRunInSpan,
} from "@/services/tracing"

const NwcEventHandler = () => {
  const logger = baseLogger.child({ module: "nwc-event-handler" })
  const blinkCoreService = BlinkCoreService()

  const enabledNotifications = (connection: NwcConnection) => {
    return connection.notificationsEnabled ? SUPPORTED_NWC_NOTIFICATIONS : []
  }

  const allowedMethods = (connection: NwcConnection): Nip47MethodType[] => {
    return connection.permissions.filter((method): method is Nip47MethodType =>
      SUPPORTED_NWC_METHODS.includes(method as Nip47MethodType),
    )
  }

  const serializeParamsForLog = (params: unknown): unknown => {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      return params
    }

    const cloned = { ...(params as Record<string, unknown>) }
    if ("invoice" in cloned) {
      cloned.invoice = "[redacted]"
    }

    return cloned
  }

  const handle = async (
    request: { method: Nip47MethodType; params?: unknown },
    connection: NwcConnection,
  ): Promise<Nip47Result> => {
    const requestLogger = logger.child({
      connectionId: connection.id,
      userId: connection.userId,
      walletId: connection.walletId,
      appPubkey: connection.appPubkey,
      method: request.method,
    })

    requestLogger.info(
      { params: serializeParamsForLog(request.params) },
      "received NWC request",
    )

    addAttributesToCurrentSpan({
      "nwc.method": request.method,
      "nwc.connectionId": connection.id,
      "nwc.userId": connection.userId,
      "nwc.walletId": connection.walletId,
      "nwc.appPubkey": connection.appPubkey,
    })

    let response: Nip47Result

    if (!SUPPORTED_NWC_METHODS.includes(request.method)) {
      response = new Nip47NotImplementedError(`Unsupported method: ${request.method}`)
    } else if (!hasPermission(request.method, connection)) {
      const error = new Nip47RestrictedError(
        `Connection does not have permission for requested operation: ${request.method}`,
      )
      recordExceptionInCurrentSpan({ error, level: ErrorLevel.Warn })
      response = error
    } else if (request.method === "get_info") {
      const serverPubkey = getServerKeypair().pubkey
      const username = await blinkCoreService.getUsername(connection.apiKey)
      const info = await blinkCoreService.getNodeInfo()

      if (info instanceof Error) {
        response = new Nip47InternalError(info.message)
      } else {
        const alias =
          typeof username === "string" && username.length > 0
            ? (username as NwcServerAlias)
            : WALLET_ALIAS

        response = {
          alias,
          color: WALLET_COLOR,
          pubkey: serverPubkey,
          methods: allowedMethods(connection),
          notifications: enabledNotifications(connection),
          network: info.network,
          block_height: info.blockHeight,
          block_hash: info.blockHash,
        }
      }
    } else {
      response = new Nip47NotImplementedError(
        `Method not implemented yet: ${request.method}`,
      )
    }

    requestLogger.info(
      response instanceof Nip47Error
        ? {
            response: {
              error: {
                code: response.code,
                message: response.message,
              },
            },
          }
        : { response: { result_type: request.method } },
      "completed NWC request",
    )

    return response
  }

  return {
    handle: wrapAsyncToRunInSpan({
      namespace: "app.nwc",
      fn: handle,
    }),
  }
}

export default NwcEventHandler
