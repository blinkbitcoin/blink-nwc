/**
 * Nip47 errors. Should be used only to send as result to nwc client.
 * Designed for informing the user about exception via generic relay messages, not to handle any api calls.
 * Won't be translated, so there's no inheritance from error class
 * See: https://docs.nwc.dev/reference-api/error-codes
 */
export class Nip47Error {
    code: string
    message: string
    constructor(message: string, code: string) {
        this.message = message
        this.code = code
    }
}
export class Nip47RateLimitedError extends Nip47Error {
    constructor(message: string) {
        super(message, "RATE_LIMITED")
    }
}
export class Nip47NotImplementedError extends Nip47Error {
    constructor(message: string) {
        super(message, "NOT_IMPLEMENTED")
    }
}
export class Nip47InsufficientBalanceError extends Nip47Error {
    constructor(message: string) {
        super(message, "INSUFFICIENT_BALANCE")
    }
}
export class Nip47QuotaExceededError extends Nip47Error {
    constructor(message: string) {
        super(message, "QUOTA_EXCEEDED")
    }
}
export class Nip47RestrictedError extends Nip47Error {
    constructor(message: string) {
        super(message, "RESTRICTED")
    }
}
export class Nip47UnauthorizedError extends Nip47Error {
    constructor(message: string) {
        super(message, "UNAUTHORIZED")
    }
}
export class Nip47InternalError extends Nip47Error {
    constructor(message: string) {
        super(message, "INTERNAL")
    }
}
export class Nip47OtherError extends Nip47Error {
    constructor(message: string) {
        super(message, "OTHER")
    }
}