import { ensureMethodPermission } from "@/app/permission-checker"
import { Nip47MethodType } from "@/domain/index.types"
import { NwcPermissionType } from "@/domain/nostr/index.types"
import { Nip47Error, Nip47UnauthorizedError } from "@/domain/nostr"

type ValidatableConnection = {
  revoked: boolean
  expiresAt: Date | null
  permissions: readonly NwcPermissionType[]
}

export const isConnectionExpired = (
  connection: Pick<ValidatableConnection, "expiresAt">,
  now = new Date(),
): boolean => {
  // Treat the timestamp as an inclusive cutoff: requests at or after it are expired.
  return connection.expiresAt != null && connection.expiresAt <= now
}

export const validateConnectionForRequest = (
  connection: ValidatableConnection,
  method: Nip47MethodType,
  now = new Date(),
): Nip47Error | null => {
  if (connection.revoked) {
    return new Nip47UnauthorizedError("Connection has been revoked")
  }

  if (isConnectionExpired(connection, now)) {
    return new Nip47UnauthorizedError("Connection has expired")
  }

  return ensureMethodPermission(connection, method)
}
