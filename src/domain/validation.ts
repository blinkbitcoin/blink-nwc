import {
  ApiKey,
  Description,
  DescriptionHash,
  InvoiceBolt11,
  MilliSatoshis,
  Nip47ListTransactionsRequest,
  Nip47LookupInvoiceRequest,
  Nip47MethodType,
  Nip47PayInvoiceRequest,
  NwcConnectionAlias,
  NwcConnectionId,
  PaymentDirection,
  PaymentHash,
  Seconds,
  UnixTimestamp,
} from "@/domain/index.types"

import {
  InvalidApiKey,
  InvalidUserId,
  InvalidWalletId,
  ValidationError,
} from "@/domain/errors"
import { UserId, WalletId } from "@/domain/core/index.types"

import { Nip47MakeInvoiceRequest } from "@/domain/nostr/index.types"
import { PaymentDirection as pt } from "@/domain/nostr/payment-direction"
import { SUPPORTED_NWC_METHODS } from "@/config"

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

export const checkedToUserId = (userId: string): UserId | ValidationError => {
  if (userId.match(UuidRegex)) {
    return userId as UserId
  }
  return new InvalidUserId(userId)
}

export const checkedToWalletId = (walletId: string): WalletId | InvalidWalletId => {
  if (!walletId.match(UuidRegex)) {
    return new InvalidWalletId(walletId)
  }
  return walletId as WalletId
}

export const checkedToApiKey = (apiKey: string): ApiKey | InvalidApiKey => {
  if (!apiKey.match(UuidRegex)) {
    return new InvalidApiKey(apiKey)
  }
  return apiKey as ApiKey
}

export const checkedToPermissions = (
  permissions: string[],
): Nip47MethodType[] | ValidationError => {
  if (!Array.isArray(permissions)) {
    return new ValidationError("Permissions must be an array")
  }

  for (const permission of permissions) {
    if (!SUPPORTED_NWC_METHODS.includes(permission as Nip47MethodType)) {
      return new ValidationError(`Invalid permission: ${permission}`)
    }
  }

  return permissions as Nip47MethodType[]
}

export const checkedToConnectionId = (
  connectionId: unknown,
): NwcConnectionId | ValidationError => {
  if (typeof connectionId !== "string") {
    return new ValidationError("Connection ID must be a string")
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(connectionId)) {
    return new ValidationError("Connection ID must be a valid UUID")
  }
  return connectionId as NwcConnectionId
}

export const checkedToNwcUpdates = (updates: {
  alias?: string | null
  permissions?: string[]
}) => {
  const checkedUpdates: Partial<{
    alias: NwcConnectionAlias | null
    permissions: Nip47MethodType[]
  }> = {}

  if ("alias" in updates) {
    if (updates.alias !== undefined) {
      const checkedAlias = checkedToNwcAlias(updates.alias)
      if (checkedAlias instanceof Error) return checkedAlias
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

export const checkedToNwcAlias = (
  alias?: unknown,
): NwcConnectionAlias | null | ValidationError => {
  if (alias == null || alias === "") {
    return null
  }

  if (typeof alias !== "string") {
    return new ValidationError("Alias must be a string")
  }

  if (alias.length > 32) {
    return new ValidationError("Alias must be under 32 characters")
  }

  const regex = /^[a-zA-Z0-9_-]+$/
  if (!regex.test(alias)) {
    return new ValidationError("Alias contains invalid characters")
  }

  return alias as NwcConnectionAlias
}

export const checkedToBolt11Invoice = (
  invoice: unknown,
): InvoiceBolt11 | ValidationError => {
  if (!(typeof invoice === "string")) {
    return new ValidationError("Invalid invoice type")
  }
  if (invoice.length === 0) {
    return new ValidationError("Invoice cannot be empty")
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
    return new ValidationError("Unknown lightning invoice prefix!")
  }

  return normalized as InvoiceBolt11
}

export const checkedToMsatAmount = (amount: unknown): MilliSatoshis | ValidationError => {
  if (!isNonNegativeInteger(amount)) {
    return new ValidationError("Amount must be a positive integer")
  }
  return amount as MilliSatoshis
}

export const checkedToUnixTimestamp = (
  timestamp: unknown,
): UnixTimestamp | ValidationError => {
  if (isPositiveInteger(timestamp)) {
    return timestamp as UnixTimestamp
  }
  return new ValidationError("Invalid timestamp input")
}

export const checkedToHash = (name: string, hash: unknown): string | ValidationError => {
  if (typeof hash !== "string") {
    return new ValidationError(`${name} must be a string`)
  }
  if (!HEX256_REGEX.test(hash)) {
    return new ValidationError(`${name} must be 64-char hex (sha256)`)
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
    return new ValidationError(`Description must be a string`)
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
    return new ValidationError("Type must be a string or undefined")
  }

  if (value !== pt.Incoming && value !== pt.Outgoing) {
    return new ValidationError('Type must be either "incoming", "outgoing" or undefined')
  }

  return value as PaymentDirection
}

export const checkedToNip47MakeInvoiceRequest = (
  req: any, // albo unknown
): Nip47MakeInvoiceRequest | ValidationError => {
  const amount = checkedToMsatAmount(req?.amount ?? 0)
  if (amount instanceof ValidationError) return amount

  const description =
    req?.description !== undefined ? checkedToDescription(req.description) : undefined
  if (description instanceof ValidationError) return description

  const descriptionHash =
    req?.description_hash !== undefined
      ? checkedToDescriptionHash(req.description_hash)
      : undefined
  if (descriptionHash instanceof ValidationError) return descriptionHash

  const expiry = req?.expiry !== undefined ? checkedToSeconds(req.expiry) : undefined
  if (expiry instanceof ValidationError) return expiry

  return {
    amount,
    description,
    description_hash: descriptionHash,
    expiry,
  }
}

export const checkedToNip47ListTransactionsRequest = (
  req: any,
): Nip47ListTransactionsRequest | ValidationError => {
  const from = req?.from !== undefined ? checkedToUnixTimestamp(req?.from) : undefined
  if (from instanceof Error) {
    return from
  }
  const until = req?.until !== undefined ? checkedToUnixTimestamp(req.until) : undefined
  if (until instanceof ValidationError) {
    return until
  }

  if ((from ? from : 0) < (until ? until : Math.round(Date.now() / 1000))) {
    return new ValidationError("From can't be smaller than until!")
  }

  const limit =
    req?.limit !== undefined
      ? checkedToNonNegativeInteger("Limit", req?.limit)
      : undefined
  if (limit instanceof ValidationError) {
    return limit
  }
  const offset =
    req?.offset !== undefined
      ? checkedToNonNegativeInteger("Offset", req.offset)
      : undefined
  if (offset instanceof ValidationError) {
    return offset
  }
  const unpaid = req?.unpaid !== undefined && req.unpaid === true ? true : undefined

  const type = checkedToPaymentDirection(req.type)
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
  req: any,
): Nip47LookupInvoiceRequest | ValidationError => {
  const payment_hash =
    req?.payment_hash !== undefined ? checkedToPaymentHash(req.payment_hash) : undefined
  if (payment_hash instanceof ValidationError) {
    return payment_hash
  }
  const invoice =
    req?.invoice !== undefined ? checkedToBolt11Invoice(req.invoice) : undefined
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
  req: any,
): Nip47PayInvoiceRequest | ValidationError => {
  const invoice =
    req?.invoice !== undefined
      ? checkedToBolt11Invoice(req.invoice)
      : new ValidationError("Invoice is required!")
  if (invoice instanceof ValidationError) {
    return invoice
  }
  return { invoice }
}
