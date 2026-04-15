import {
  ApiKey,
  ApiKeyId,
  Description,
  DescriptionHash,
  InvoiceBolt11,
  MilliSatoshis,
  Nip47ListTransactionsRequest,
  Nip47LookupInvoiceRequest,
  Nip47MethodType,
  NwcPermissionType,
  Nip47PayInvoiceRequest,
  NwcConnectionAlias,
  NwcConnectionId,
  PaymentDirection,
  PaymentHash,
  Seconds,
  UnixTimestamp,
} from "@/domain/index.types"

import {
  InvalidAmount,
  InvalidApiKey,
  InvalidDescription,
  InvalidHash,
  InvalidInvoice,
  InvalidNwcAlias,
  InvalidNwcBudget,
  InvalidNwcConnectionId,
  InvalidNwcUri,
  InvalidPaymentDirection,
  InvalidPermissions,
  InvalidUnixTimestamp,
  InvalidUserId,
  InvalidWalletId,
  ValidationError,
} from "@/domain/errors"
import { UserId, WalletId } from "@/domain/core/index.types"

import { Nip47MakeInvoiceRequest } from "@/domain/nostr/index.types"
import { PaymentDirection as pt } from "@/domain/nostr/payment-direction"
import { SUPPORTED_NWC_METHODS } from "@/config"
import { SUPPORTED_NWC_NOTIFICATION_PERMISSIONS } from "@/domain/nostr/notification-type"
import {
  isNwcBudgetPeriod,
  NwcBudgetInput,
  NwcBudgetPeriodType,
} from "@/domain/nwc-budget"

// borrowed from
// https://github.com/blinkbitcoin/blink/blob/3c8841395f94346024c85c0137236ac4ca4d8d70/core/api/src/domain/shared/validation.ts

const UuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const HEX256_REGEX = /^[0-9a-fA-F]{64}$/

const isPositiveInteger = (value: unknown): value is number => {
  return (
    typeof value === "number" && isFinite(value) && value > 0 && Number.isInteger(value)
  )
}

const isNonNegativeInteger = (value: unknown): value is number => {
  return (
    typeof value === "number" && isFinite(value) && value >= 0 && Number.isInteger(value)
  )
}

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined
  }

  return value as Record<string, unknown>
}

export const checkedToUserId = (userId: string): UserId | ValidationError => {
  if (!userId.match(UuidRegex)) {
    return new InvalidUserId(userId)
  }
  return userId as UserId
}

export const checkedToWalletId = (walletId: string): WalletId | InvalidWalletId => {
  if (!walletId.match(UuidRegex)) {
    return new InvalidWalletId(walletId)
  }
  return walletId as WalletId
}

export const checkedToApiKey = (apiKey: string): ApiKey | InvalidApiKey => {
  if (!apiKey || apiKey.trim().length === 0) {
    return new InvalidApiKey("API key cannot be empty")
  }
  return apiKey as ApiKey
}

export const checkedToApiKeyId = (apiKeyId: string): ApiKeyId | InvalidApiKey => {
  if (!apiKeyId.match(UuidRegex)) {
    return new InvalidApiKey(apiKeyId)
  }
  return apiKeyId as ApiKeyId
}

export const checkedToNwcUri = (uri: unknown): string | InvalidNwcUri => {
  if (typeof uri !== "string" || uri.trim().length === 0) {
    return new InvalidNwcUri("NWC URI cannot be empty")
  }

  return uri.trim()
}

export const checkedToPermissions = (
  permissions: string[],
): NwcPermissionType[] | ValidationError => {
  if (!Array.isArray(permissions)) {
    return new InvalidPermissions("Permissions must be an array")
  }

  for (const permission of permissions) {
    const isMethodPermission = SUPPORTED_NWC_METHODS.includes(
      permission as Nip47MethodType,
    )
    const isNotificationPermission = SUPPORTED_NWC_NOTIFICATION_PERMISSIONS.includes(
      permission as (typeof SUPPORTED_NWC_NOTIFICATION_PERMISSIONS)[number],
    )

    if (!isMethodPermission && !isNotificationPermission) {
      return new InvalidPermissions(`Invalid permission: ${permission}`)
    }
  }

  return permissions as NwcPermissionType[]
}

export const checkedToNwcAlias = (
  alias?: unknown,
): NwcConnectionAlias | null | ValidationError => {
  if (alias == null || alias === "") {
    return null
  }

  if (typeof alias !== "string") {
    return new InvalidNwcAlias("Alias must be a string")
  }

  if (alias.length > 32) {
    return new InvalidNwcAlias("Alias must be under 32 characters")
  }

  const regex = /^[a-zA-Z0-9_-]+$/
  if (!regex.test(alias)) {
    return new InvalidNwcAlias("Alias contains invalid characters")
  }

  return alias as NwcConnectionAlias
}

export const checkedToNwcBudgetInput = (
  budget: unknown,
): NwcBudgetInput | null | ValidationError => {
  if (budget == null) {
    return null
  }

  if (typeof budget !== "object" || Array.isArray(budget)) {
    return new InvalidNwcBudget("Budget must be an object")
  }

  const { amountSats, period } = budget as {
    amountSats?: unknown
    period?: unknown
  }

  if (!isPositiveInteger(amountSats)) {
    return new InvalidNwcBudget("Budget amount must be a positive integer")
  }

  if (!isNwcBudgetPeriod(period)) {
    return new InvalidNwcBudget(`Invalid budget period: ${String(period)}`)
  }

  return {
    amountSats,
    period: period as NwcBudgetPeriodType,
  }
}

export const checkedToConnectionId = (
  connectionId: unknown,
): NwcConnectionId | ValidationError => {
  if (typeof connectionId !== "string") {
    return new InvalidNwcConnectionId("Connection ID must be a string")
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(connectionId)) {
    return new InvalidNwcConnectionId("Connection ID must be a valid UUID")
  }
  return connectionId as NwcConnectionId
}

export const checkedToNwcUpdates = (updates: {
  alias?: string | null
  permissions?: string[]
}) => {
  const checkedUpdates: Partial<{
    alias: NwcConnectionAlias | null
    permissions: NwcPermissionType[]
  }> = {}

  if ("alias" in updates) {
    if (updates.alias !== undefined) {
      const checkedAlias = checkedToNwcAlias(updates.alias)
      if (checkedAlias instanceof Error) {
        return checkedAlias
      }
      checkedUpdates.alias = checkedAlias
    } else {
      checkedUpdates.alias = undefined
    }
  }

  if ("permissions" in updates) {
    if (updates.permissions !== undefined) {
      const checkedPermissions = checkedToPermissions(updates.permissions)
      if (checkedPermissions instanceof Error) return checkedPermissions
      checkedUpdates.permissions = checkedPermissions
    } else {
      checkedUpdates.permissions = undefined
    }
  }

  return checkedUpdates
}

export const checkedToBolt11Invoice = (
  invoice: unknown,
): InvoiceBolt11 | ValidationError => {
  if (!(typeof invoice === "string")) {
    return new InvalidInvoice("Invalid invoice type")
  }
  if (invoice.length === 0) {
    return new InvalidInvoice("Invoice cannot be empty")
  }

  if (invoice !== invoice.toLowerCase() && invoice !== invoice.toUpperCase()) {
    return new InvalidInvoice("Invoice must use a single-case bech32 encoding")
  }

  const normalized = invoice.toLowerCase()

  if (
    !(
      normalized.startsWith("lnbc") ||
      normalized.startsWith("lntb") ||
      normalized.startsWith("lnsb") ||
      normalized.startsWith("lnbcrt")
    )
  ) {
    return new InvalidInvoice("Unknown lightning invoice prefix!")
  }

  return normalized as InvoiceBolt11
}

export const checkedToMsatAmount = (amount: unknown): MilliSatoshis | ValidationError => {
  if (!isNonNegativeInteger(amount)) {
    return new InvalidAmount("Amount must be a non-negative integer")
  }
  return amount as MilliSatoshis
}

const checkedToWholeSatoshiMsatAmount = (
  amount: MilliSatoshis,
): MilliSatoshis | ValidationError => {
  if (amount % 1000 !== 0) {
    return new InvalidAmount(
      "Amount must be a whole number of satoshis (multiple of 1000 millisatoshis)",
    )
  }

  return amount
}

export const checkedToUnixTimestamp = (
  timestamp: unknown,
): UnixTimestamp | ValidationError => {
  if (isPositiveInteger(timestamp)) {
    return timestamp as UnixTimestamp
  }
  return new InvalidUnixTimestamp("Invalid timestamp input")
}

export const checkedToHash = (name: string, hash: unknown): string | ValidationError => {
  if (typeof hash !== "string") {
    return new InvalidHash(`${name} must be a string`)
  }
  if (!HEX256_REGEX.test(hash)) {
    return new InvalidHash(`${name} must be 64-char hex (sha256)`)
  }
  return hash.toLowerCase()
}

export const checkedToDescriptionHash = (
  descriptionHash: unknown,
): DescriptionHash | ValidationError => {
  const checked = checkedToHash("Description Hash", descriptionHash)
  if (checked instanceof ValidationError) {
    return checked
  }
  return checked as DescriptionHash
}

export const checkedToDescription = (
  description: unknown,
): Description | ValidationError => {
  if (typeof description !== "string") {
    return new InvalidDescription(`Description must be a string`)
  }
  return description as Description
}

export const checkedToSeconds = (seconds: unknown): Seconds | ValidationError => {
  if (!isNonNegativeInteger(seconds)) {
    return new ValidationError("Seconds must be a positive integer")
  }
  return seconds as Seconds
}

export const checkedToPaymentHash = (
  paymentHash: unknown,
): PaymentHash | ValidationError => {
  const checked = checkedToHash("Payment Hash", paymentHash)
  if (checked instanceof ValidationError) {
    return checked
  }
  return checked as PaymentHash
}

export const checkedToNonNegativeInteger = (
  name: string,
  value: unknown,
): number | ValidationError => {
  if (isNonNegativeInteger(value)) {
    return value as number
  }
  return new ValidationError(`${name} must be an integer!`)
}

export const checkedToPaymentDirection = (
  value: unknown,
): PaymentDirection | ValidationError => {
  if (value === undefined || value === pt.Both) {
    return pt.Both
  }

  if (typeof value !== "string") {
    return new InvalidPaymentDirection("Type must be a string or undefined")
  }

  if (value !== pt.Incoming && value !== pt.Outgoing) {
    return new InvalidPaymentDirection(
      'Type must be either "incoming", "outgoing" or undefined',
    )
  }

  return value as PaymentDirection
}

export const checkedToNip47MakeInvoiceRequest = (
  req: unknown,
): Nip47MakeInvoiceRequest | ValidationError => {
  const input = asRecord(req)

  const amount = checkedToMsatAmount(input?.amount ?? 0)
  if (amount instanceof ValidationError) return amount
  const wholeSatoshiAmount = checkedToWholeSatoshiMsatAmount(amount)
  if (wholeSatoshiAmount instanceof ValidationError) return wholeSatoshiAmount

  const description =
    input?.description !== undefined ? checkedToDescription(input.description) : undefined
  if (description instanceof ValidationError) return description

  const descriptionHash =
    input?.description_hash !== undefined
      ? checkedToDescriptionHash(input.description_hash)
      : undefined
  if (descriptionHash instanceof ValidationError) return descriptionHash

  const expiry = input?.expiry !== undefined ? checkedToSeconds(input.expiry) : undefined
  if (expiry instanceof ValidationError) return expiry

  if (wholeSatoshiAmount === 0 && descriptionHash !== undefined) {
    return new ValidationError(
      "description_hash is not supported for amountless invoices",
    )
  }

  return {
    amount: wholeSatoshiAmount,
    description,
    description_hash: descriptionHash,
    expiry,
  }
}

export const checkedToNip47ListTransactionsRequest = (
  req: unknown,
): Nip47ListTransactionsRequest | ValidationError => {
  const input = asRecord(req)

  const from = input?.from !== undefined ? checkedToUnixTimestamp(input.from) : undefined
  if (from instanceof ValidationError) {
    return from
  }
  const until = input?.until !== undefined ? checkedToUnixTimestamp(input.until) : undefined
  if (until instanceof ValidationError) {
    return until
  }

  if ((from ? from : 0) > (until ? until : Math.round(Date.now() / 1000))) {
    return new ValidationError("Until can't be smaller than from!")
  }

  const limit =
    input?.limit !== undefined
      ? checkedToNonNegativeInteger("Limit", input.limit)
      : undefined
  if (limit instanceof ValidationError) {
    return limit
  }
  const offset =
    input?.offset !== undefined
      ? checkedToNonNegativeInteger("Offset", input.offset)
      : undefined
  if (offset instanceof ValidationError) {
    return offset
  }
  const unpaid = input?.unpaid === true ? true : undefined

  const type = checkedToPaymentDirection(input?.type)
  if (type instanceof ValidationError) {
    return type
  }

  return {
    from,
    limit,
    offset,
    type,
    unpaid,
    until,
  }
}

export const checkedToNip47LookupInvoiceRequest = (
  req: unknown,
): Nip47LookupInvoiceRequest | ValidationError => {
  const input = asRecord(req)

  const payment_hash =
    input?.payment_hash !== undefined
      ? checkedToPaymentHash(input.payment_hash)
      : undefined
  if (payment_hash instanceof ValidationError) {
    return payment_hash
  }
  const invoice =
    input?.invoice !== undefined ? checkedToBolt11Invoice(input.invoice) : undefined
  if (invoice instanceof ValidationError) {
    return invoice
  }
  if (invoice == undefined && payment_hash == undefined) {
    return new ValidationError(
      "Lookup invoice request must contain either invoice or payment_hash!",
    )
  }
  return {
    invoice,
    payment_hash,
  }
}

export const checkedToNip47PayInvoiceRequest = (
  req: unknown,
): Nip47PayInvoiceRequest | ValidationError => {
  const input = asRecord(req)

  const invoice =
    input?.invoice !== undefined
      ? checkedToBolt11Invoice(input.invoice)
      : new InvalidInvoice("Invoice is required!")
  if (invoice instanceof ValidationError) {
    return invoice
  }

  const amount = input?.amount !== undefined ? checkedToMsatAmount(input.amount) : undefined
  if (amount instanceof ValidationError) {
    return amount
  }
  if (amount !== undefined) {
    const wholeSatoshiAmount = checkedToWholeSatoshiMsatAmount(amount)
    if (wholeSatoshiAmount instanceof ValidationError) {
      return wholeSatoshiAmount
    }
    if (wholeSatoshiAmount === 0) {
      return new InvalidAmount("Amount must be a positive integer")
    }

    return { invoice, amount: wholeSatoshiAmount }
  }

  if (amount === 0) {
    return new InvalidAmount("Amount must be a positive integer")
  }

  return { invoice, amount }
}
