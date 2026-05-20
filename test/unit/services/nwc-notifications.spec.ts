import {
  buildNotificationFromTransactionEvent,
  NwcNotificationPublisher,
} from "@/services/nwc-notifications"
import { BlinkServiceError } from "@/services/core/errors"
import { RepositoryError, UniqueConstraintViolationError } from "@/domain/errors"
import { NOTIFICATION_ONCE_INDEX } from "@/services/db/notification-audit"
import {
  TransactionEvent,
  TransactionType,
} from "@/services/core/grpc/proto/transactions_pb"

const createLogger = () =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as any

const createMonitoring = () =>
  ({
    markTransactionStreamConnected: jest.fn(),
    markTransactionStreamDisconnected: jest.fn(),
    recordTransactionStreamReconnect: jest.fn(),
    recordTransactionStreamReplayLag: jest.fn(),
    recordTransactionStreamReplayLagFromTimestamp: jest.fn(),
    recordNotificationPublished: jest.fn(),
    recordNotificationPublishDuration: jest.fn(),
    recordNotificationPublishError: jest.fn(),
    renderMetrics: jest.fn(),
    getHealthSnapshot: jest.fn(),
  }) as any

const createNotificationAuditRepository = (overrides: Record<string, jest.Mock> = {}) =>
  ({
    hasPublishedNotification: jest.fn().mockResolvedValue(false),
    recordPublishedNotification: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as any

const createTransactionEvent = ({
  currency = "BTC",
  type = TransactionType.RECEIVED,
  paymentHash = "payment-hash-1",
}: {
  currency?: string
  type?: TransactionType
  paymentHash?: string
} = {}) => {
  const event = new TransactionEvent()
  event.setLedgerTransactionId("ledger-tx-1")
  event.setWalletId("wallet-1")
  event.setAccountId("account-1")
  event.setPaymentHash(paymentHash)
  event.setSatsAmount(21)
  event.setCurrency(currency)
  event.setType(type)
  event.setTimestamp(1710000000)
  return event
}

describe("buildNotificationFromTransactionEvent", () => {
  it("maps a received transaction event into a payment_received notification", () => {
    const event = createTransactionEvent()

    const notification = buildNotificationFromTransactionEvent(event, {
      type: "incoming",
      paymentHash: "payment-hash-1" as never,
      amount: 42 as never,
      feesPaid: 1 as never,
      createdAt: 1710000000 as never,
      settledAt: 1710000001 as never,
      invoice: "lnbc1invoice" as never,
      description: "memo" as never,
      descriptionHash: "description-hash" as never,
      preimage: "preimage-1" as never,
    })

    expect(notification).toEqual(
      expect.objectContaining({
        notification_type: "payment_received",
        notification: expect.objectContaining({
          type: "incoming",
          payment_hash: "payment-hash-1",
          amount: 42000,
          fees_paid: 1000,
          invoice: "lnbc1invoice",
          preimage: "preimage-1",
        }),
      }),
    )
  })

  it("maps a sent transaction event using stream fields when enrichment is unavailable", () => {
    const event = createTransactionEvent({
      type: TransactionType.SENT,
    })

    const notification = buildNotificationFromTransactionEvent(event)

    expect(notification).toEqual(
      expect.objectContaining({
        notification_type: "payment_sent",
        notification: expect.objectContaining({
          type: "outgoing",
          payment_hash: "payment-hash-1",
          amount: 21000,
          fees_paid: 0,
          settled_at: 1710000000,
        }),
      }),
    )
    expect(notification?.notification).not.toHaveProperty("preimage")
  })

  it("returns undefined when the event cannot be mapped into a notification", () => {
    const unsupportedTypeEvent = createTransactionEvent({
      type: TransactionType.TRANSACTION_TYPE_UNSPECIFIED,
    })
    const missingPaymentHashEvent = createTransactionEvent({
      paymentHash: "",
    })
    const invalidTimestampEvent = createTransactionEvent()
    invalidTimestampEvent.setTimestamp(Number.NaN as never)

    expect(buildNotificationFromTransactionEvent(unsupportedTypeEvent)).toBeUndefined()
    expect(buildNotificationFromTransactionEvent(missingPaymentHashEvent)).toBeUndefined()

    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(Number.NaN)

    expect(buildNotificationFromTransactionEvent(invalidTimestampEvent)).toBeUndefined()

    dateNowSpy.mockRestore()
  })
})

describe("NwcNotificationPublisher", () => {
  it("closes the relay when stopped", async () => {
    const relay = {
      connected: true,
      connect: jest.fn(),
      close: jest.fn(),
    }

    const publisher = NwcNotificationPublisher({
      relay: relay as any,
      notificationService: { sendNotification: jest.fn() } as any,
      connectionsRepository: {
        findByWalletIdWithNotificationPerm: jest.fn(),
      } as any,
      coreService: { lookupInvoice: jest.fn() } as any,
      logger: createLogger(),
    })

    await publisher.stop()

    expect(relay.close).toHaveBeenCalledTimes(1)
  })

  it("ignores pending transaction events", async () => {
    const event = createTransactionEvent()
    event.setPending(true)

    const connectionsRepository = {
      findByWalletIdWithNotificationPerm: jest.fn(),
    }

    const publisher = NwcNotificationPublisher({
      relay: {
        connected: true,
        connect: jest.fn(),
        close: jest.fn(),
      } as any,
      notificationService: { sendNotification: jest.fn() } as any,
      connectionsRepository: connectionsRepository as any,
      coreService: { lookupInvoice: jest.fn() } as any,
      logger: createLogger(),
    })

    await publisher.publishTransactionEvent(event)

    expect(
      connectionsRepository.findByWalletIdWithNotificationPerm,
    ).not.toHaveBeenCalled()
  })

  it("rejects transaction events without a durable ledger cursor before side effects", async () => {
    const event = createTransactionEvent()
    event.setLedgerTransactionId("")
    const connectionsRepository = {
      findByWalletIdWithNotificationPerm: jest.fn(),
    }
    const notificationService = {
      sendNotification: jest.fn(),
    }

    const publisher = NwcNotificationPublisher({
      relay: {
        connected: true,
        connect: jest.fn(),
        close: jest.fn(),
      } as any,
      notificationService: notificationService as any,
      connectionsRepository: connectionsRepository as any,
      coreService: { lookupInvoice: jest.fn() } as any,
      logger: createLogger(),
    })

    await expect(publisher.publishTransactionEvent(event)).rejects.toThrow(
      "Missing ledger transaction id",
    )
    expect(
      connectionsRepository.findByWalletIdWithNotificationPerm,
    ).not.toHaveBeenCalled()
    expect(notificationService.sendNotification).not.toHaveBeenCalled()
  })

  it("ignores non-BTC transaction events", async () => {
    const connectionsRepository = {
      findByWalletIdWithNotificationPerm: jest.fn(),
    }

    const publisher = NwcNotificationPublisher({
      relay: {
        connected: true,
        connect: jest.fn(),
        close: jest.fn(),
      } as any,
      notificationService: { sendNotification: jest.fn() } as any,
      connectionsRepository: connectionsRepository as any,
      coreService: { lookupInvoice: jest.fn() } as any,
      logger: createLogger(),
    })

    await publisher.publishTransactionEvent(
      createTransactionEvent({
        currency: "USD",
      }),
    )

    expect(
      connectionsRepository.findByWalletIdWithNotificationPerm,
    ).not.toHaveBeenCalled()
  })

  it("ignores unsupported transaction types and missing payment hashes", async () => {
    const connectionsRepository = {
      findByWalletIdWithNotificationPerm: jest.fn(),
    }

    const publisher = NwcNotificationPublisher({
      relay: {
        connected: true,
        connect: jest.fn(),
        close: jest.fn(),
      } as any,
      notificationService: { sendNotification: jest.fn() } as any,
      connectionsRepository: connectionsRepository as any,
      coreService: { lookupInvoice: jest.fn() } as any,
      logger: createLogger(),
    })

    await publisher.publishTransactionEvent(
      createTransactionEvent({
        type: TransactionType.TRANSACTION_TYPE_UNSPECIFIED,
      }),
    )

    await publisher.publishTransactionEvent(
      createTransactionEvent({
        paymentHash: "",
      }),
    )

    expect(
      connectionsRepository.findByWalletIdWithNotificationPerm,
    ).not.toHaveBeenCalled()
  })

  it("does nothing when no matching connections are found", async () => {
    const relay = {
      connected: false,
      connect: jest.fn(),
      close: jest.fn(),
    }
    const notificationService = {
      sendNotification: jest.fn(),
    }
    const connectionsRepository = {
      findByWalletIdWithNotificationPerm: jest.fn().mockResolvedValue([]),
    }
    const coreService = {
      lookupInvoice: jest.fn(),
    }

    const publisher = NwcNotificationPublisher({
      relay: relay as any,
      notificationService: notificationService as any,
      connectionsRepository: connectionsRepository as any,
      coreService: coreService as any,
      logger: createLogger(),
    })

    await publisher.publishTransactionEvent(createTransactionEvent())

    expect(coreService.lookupInvoice).not.toHaveBeenCalled()
    expect(relay.connect).not.toHaveBeenCalled()
    expect(notificationService.sendNotification).not.toHaveBeenCalled()
  })

  it("throws when the connection lookup fails", async () => {
    const publisher = NwcNotificationPublisher({
      relay: {
        connected: true,
        connect: jest.fn(),
        close: jest.fn(),
      } as any,
      notificationService: { sendNotification: jest.fn() } as any,
      connectionsRepository: {
        findByWalletIdWithNotificationPerm: jest
          .fn()
          .mockResolvedValue(new RepositoryError("db failure")),
      } as any,
      coreService: { lookupInvoice: jest.fn() } as any,
      logger: createLogger(),
    })

    await expect(
      publisher.publishTransactionEvent(createTransactionEvent()),
    ).rejects.toThrow("db failure")
  })

  it("returns without publishing when the notification cannot be built", async () => {
    const invalidTimestampEvent = createTransactionEvent()
    invalidTimestampEvent.setTimestamp(Number.NaN as never)

    const relay = {
      connected: false,
      connect: jest.fn(),
      close: jest.fn(),
    }
    const notificationService = {
      sendNotification: jest.fn(),
    }
    const connectionsRepository = {
      findByWalletIdWithNotificationPerm: jest.fn().mockResolvedValue([
        {
          id: "connection-1",
          appPubkey: "app-pubkey-1",
          apiKey: "api-key-1",
          walletId: "wallet-1",
        },
      ]),
    }

    const publisher = NwcNotificationPublisher({
      relay: relay as any,
      notificationService: notificationService as any,
      connectionsRepository: connectionsRepository as any,
      coreService: {
        lookupInvoice: jest
          .fn()
          .mockResolvedValue(new BlinkServiceError("lookup failed")),
      } as any,
      notificationAuditRepository: createNotificationAuditRepository(),
      logger: createLogger(),
    })

    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(Number.NaN)
    await publisher.publishTransactionEvent(invalidTimestampEvent)
    dateNowSpy.mockRestore()

    expect(relay.connect).not.toHaveBeenCalled()
    expect(notificationService.sendNotification).not.toHaveBeenCalled()
  })

  it("publishes notifications to matching wallet connections", async () => {
    const relay = {
      connected: false,
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    }
    const notificationService = {
      sendNotification: jest.fn().mockResolvedValue(true),
    }
    const connectionsRepository = {
      findByWalletIdWithNotificationPerm: jest.fn().mockResolvedValue([
        {
          id: "connection-1",
          appPubkey: "app-pubkey-1",
          apiKey: "api-key-1",
          walletId: "wallet-1",
        },
        {
          id: "connection-2",
          appPubkey: "app-pubkey-2",
          apiKey: "api-key-1",
          walletId: "wallet-1",
        },
      ]),
    }
    const coreService = {
      lookupInvoice: jest.fn().mockResolvedValue({
        type: "incoming",
        paymentHash: "payment-hash-1",
        amount: 42,
        feesPaid: 1,
        createdAt: 1710000000,
        settledAt: 1710000001,
        invoice: "lnbc1invoice",
        preimage: "preimage-1",
      }),
    }
    const monitoring = createMonitoring()
    const notificationAuditRepository = createNotificationAuditRepository()

    const publisher = NwcNotificationPublisher({
      relay: relay as any,
      notificationService: notificationService as any,
      connectionsRepository: connectionsRepository as any,
      coreService: coreService as any,
      notificationAuditRepository,
      logger: createLogger(),
      monitoring,
    })

    await publisher.publishTransactionEvent(createTransactionEvent())

    expect(connectionsRepository.findByWalletIdWithNotificationPerm).toHaveBeenCalledWith(
      "wallet-1",
      "notifications:payment_received",
    )
    expect(coreService.lookupInvoice).toHaveBeenCalledWith(
      "api-key-1",
      "wallet-1",
      "payment-hash-1",
    )
    expect(relay.connect).toHaveBeenCalledTimes(1)
    expect(notificationService.sendNotification).toHaveBeenCalledTimes(2)
    expect(notificationService.sendNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        notification_type: "payment_received",
      }),
      "app-pubkey-1",
    )
    expect(monitoring.recordNotificationPublished).toHaveBeenCalledTimes(2)
    expect(monitoring.recordNotificationPublished).toHaveBeenNthCalledWith(
      1,
      "payment_received",
    )
    expect(monitoring.recordNotificationPublishDuration).toHaveBeenCalledTimes(2)
    expect(monitoring.recordNotificationPublishError).not.toHaveBeenCalled()
    expect(notificationAuditRepository.recordPublishedNotification).toHaveBeenCalledTimes(
      2,
    )
  })

  it("falls back to stream fields when invoice enrichment fails", async () => {
    const notificationService = {
      sendNotification: jest.fn().mockResolvedValue(true),
    }
    const connectionsRepository = {
      findByWalletIdWithNotificationPerm: jest.fn().mockResolvedValue([
        {
          id: "connection-1",
          appPubkey: "app-pubkey-1",
          apiKey: "api-key-1",
          walletId: "wallet-1",
        },
      ]),
    }
    const coreService = {
      lookupInvoice: jest.fn().mockResolvedValue(new BlinkServiceError("lookup failed")),
    }
    const logger = createLogger()

    const publisher = NwcNotificationPublisher({
      relay: {
        connected: true,
        connect: jest.fn(),
        close: jest.fn(),
      } as any,
      notificationService: notificationService as any,
      connectionsRepository: connectionsRepository as any,
      coreService: coreService as any,
      notificationAuditRepository: createNotificationAuditRepository(),
      logger,
    })

    await publisher.publishTransactionEvent(
      createTransactionEvent({
        type: TransactionType.SENT,
      }),
    )

    expect(notificationService.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_type: "payment_sent",
        notification: expect.objectContaining({
          amount: 21000,
        }),
      }),
      "app-pubkey-1",
    )
    expect(
      (notificationService.sendNotification as jest.Mock).mock.calls[0][0].notification,
    ).not.toHaveProperty("preimage")
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(BlinkServiceError),
        ledgerTransactionId: "ledger-tx-1",
        paymentHash: "payment-hash-1",
      }),
      "failed to enrich transaction event from Blink Core, falling back to stream data",
    )
  })

  it("throws when publishing to any connection fails", async () => {
    const monitoring = createMonitoring()
    const notificationAuditRepository = createNotificationAuditRepository()
    const publisher = NwcNotificationPublisher({
      relay: {
        connected: true,
        connect: jest.fn(),
        close: jest.fn(),
      } as any,
      notificationService: {
        sendNotification: jest.fn().mockResolvedValue(false),
      } as any,
      connectionsRepository: {
        findByWalletIdWithNotificationPerm: jest.fn().mockResolvedValue([
          {
            id: "connection-1",
            appPubkey: "app-pubkey-1",
            apiKey: "api-key-1",
            walletId: "wallet-1",
          },
        ]),
      } as any,
      coreService: {
        lookupInvoice: jest.fn().mockResolvedValue({
          type: "incoming",
          paymentHash: "payment-hash-1",
          amount: 42,
          feesPaid: 1,
          createdAt: 1710000000,
          settledAt: 1710000001,
        }),
      } as any,
      logger: createLogger(),
      notificationAuditRepository,
      monitoring,
    })

    await expect(
      publisher.publishTransactionEvent(createTransactionEvent()),
    ).rejects.toThrow("Failed to publish payment_received for connection connection-1")
    expect(monitoring.recordNotificationPublishError).toHaveBeenCalledWith(
      "payment_received",
    )
    expect(monitoring.recordNotificationPublishDuration).toHaveBeenCalledTimes(1)
    expect(notificationAuditRepository.recordPublishedNotification).not.toHaveBeenCalled()
  })

  it("skips connections that already have a successful notification audit row on replay", async () => {
    const notificationService = {
      sendNotification: jest.fn().mockResolvedValue(true),
    }
    const connectionsRepository = {
      findByWalletIdWithNotificationPerm: jest.fn().mockResolvedValue([
        {
          id: "connection-1",
          appPubkey: "app-pubkey-1",
          apiKey: "api-key-1",
          walletId: "wallet-1",
          userId: "user-1",
        },
        {
          id: "connection-2",
          appPubkey: "app-pubkey-2",
          apiKey: "api-key-1",
          walletId: "wallet-1",
          userId: "user-1",
        },
      ]),
    }
    const notificationAuditRepository = createNotificationAuditRepository({
      hasPublishedNotification: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    })

    const publisher = NwcNotificationPublisher({
      relay: {
        connected: true,
        connect: jest.fn(),
        close: jest.fn(),
      } as any,
      notificationService: notificationService as any,
      connectionsRepository: connectionsRepository as any,
      coreService: {
        lookupInvoice: jest
          .fn()
          .mockResolvedValue(new BlinkServiceError("lookup failed")),
      } as any,
      notificationAuditRepository,
      logger: createLogger(),
    })

    await publisher.publishTransactionEvent(createTransactionEvent())

    expect(notificationService.sendNotification).toHaveBeenCalledTimes(1)
    expect(notificationService.sendNotification).toHaveBeenCalledWith(
      expect.anything(),
      "app-pubkey-2",
    )
    expect(notificationAuditRepository.recordPublishedNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: "connection-2",
        ledgerTransactionId: "ledger-tx-1",
        notificationType: "payment_received",
        paymentHash: "payment-hash-1",
      }),
    )
  })

  it("does not connect to the relay when every connection was already audited", async () => {
    const relay = {
      connected: false,
      connect: jest.fn(),
      close: jest.fn(),
    }
    const notificationService = {
      sendNotification: jest.fn().mockResolvedValue(true),
    }
    const notificationAuditRepository = createNotificationAuditRepository({
      hasPublishedNotification: jest.fn().mockResolvedValue(true),
    })

    const publisher = NwcNotificationPublisher({
      relay: relay as any,
      notificationService: notificationService as any,
      connectionsRepository: {
        findByWalletIdWithNotificationPerm: jest.fn().mockResolvedValue([
          {
            id: "connection-1",
            appPubkey: "app-pubkey-1",
            apiKey: "api-key-1",
            walletId: "wallet-1",
            userId: "user-1",
          },
        ]),
      } as any,
      coreService: {
        lookupInvoice: jest
          .fn()
          .mockResolvedValue(new BlinkServiceError("lookup failed")),
      } as any,
      notificationAuditRepository,
      logger: createLogger(),
    })

    await publisher.publishTransactionEvent(createTransactionEvent())

    expect(relay.connect).not.toHaveBeenCalled()
    expect(notificationService.sendNotification).not.toHaveBeenCalled()
    expect(notificationAuditRepository.recordPublishedNotification).not.toHaveBeenCalled()
  })

  it("treats the notification audit unique conflict as already recorded after publish", async () => {
    const monitoring = createMonitoring()
    const notificationAuditRepository = createNotificationAuditRepository({
      recordPublishedNotification: jest
        .fn()
        .mockResolvedValue(new UniqueConstraintViolationError(NOTIFICATION_ONCE_INDEX)),
    })
    const notificationService = {
      sendNotification: jest.fn().mockResolvedValue(true),
    }

    const publisher = NwcNotificationPublisher({
      relay: {
        connected: true,
        connect: jest.fn(),
        close: jest.fn(),
      } as any,
      notificationService: notificationService as any,
      connectionsRepository: {
        findByWalletIdWithNotificationPerm: jest.fn().mockResolvedValue([
          {
            id: "connection-1",
            appPubkey: "app-pubkey-1",
            apiKey: "api-key-1",
            walletId: "wallet-1",
            userId: "user-1",
          },
        ]),
      } as any,
      coreService: {
        lookupInvoice: jest
          .fn()
          .mockResolvedValue(new BlinkServiceError("lookup failed")),
      } as any,
      notificationAuditRepository,
      logger: createLogger(),
      monitoring,
    })

    await expect(
      publisher.publishTransactionEvent(createTransactionEvent()),
    ).resolves.toBeUndefined()

    expect(notificationService.sendNotification).toHaveBeenCalledTimes(1)
    expect(monitoring.recordNotificationPublished).toHaveBeenCalledWith(
      "payment_received",
    )
    expect(monitoring.recordNotificationPublishError).not.toHaveBeenCalled()
  })

  it("records successful fan-out before surfacing a later publish failure", async () => {
    const notificationService = {
      sendNotification: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    }
    const notificationAuditRepository = createNotificationAuditRepository()
    const publisher = NwcNotificationPublisher({
      relay: {
        connected: true,
        connect: jest.fn(),
        close: jest.fn(),
      } as any,
      notificationService: notificationService as any,
      connectionsRepository: {
        findByWalletIdWithNotificationPerm: jest.fn().mockResolvedValue([
          {
            id: "connection-1",
            appPubkey: "app-pubkey-1",
            apiKey: "api-key-1",
            walletId: "wallet-1",
            userId: "user-1",
          },
          {
            id: "connection-2",
            appPubkey: "app-pubkey-2",
            apiKey: "api-key-1",
            walletId: "wallet-1",
            userId: "user-1",
          },
        ]),
      } as any,
      coreService: {
        lookupInvoice: jest
          .fn()
          .mockResolvedValue(new BlinkServiceError("lookup failed")),
      } as any,
      notificationAuditRepository,
      logger: createLogger(),
    })

    await expect(
      publisher.publishTransactionEvent(createTransactionEvent()),
    ).rejects.toThrow("Failed to publish payment_received")

    expect(notificationAuditRepository.recordPublishedNotification).toHaveBeenCalledTimes(
      1,
    )
    expect(notificationAuditRepository.recordPublishedNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: "connection-1",
        ledgerTransactionId: "ledger-tx-1",
      }),
    )
  })
})
