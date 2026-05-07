import type { NwcConnection } from "@/domain/connection"
import { Nip47UnauthorizedError } from "@/domain/nostr"

type ValidatableConnection = Pick<NwcConnection, "revoked" | "expiresAt">

export const isConnectionExpired = (
  connection: Pick<ValidatableConnection, "expiresAt">,
  now = new Date(),
): boolean => {
  // Treat the timestamp as an inclusive cutoff: requests at or after it are expired.
  return connection.expiresAt != null && connection.expiresAt <= now
}

export const validateConnectionState = (
  connection: ValidatableConnection,
  now = new Date(),
): Nip47UnauthorizedError | null => {
  if (connection.revoked) {
    return new Nip47UnauthorizedError("Connection has been revoked")
  }

  if (isConnectionExpired(connection, now)) {
    return new Nip47UnauthorizedError("Connection has expired")
  }

  return null
}
