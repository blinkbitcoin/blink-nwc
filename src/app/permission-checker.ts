import { Nip47MethodType } from "@/domain/index.types"
import { NwcPermissionType } from "@/domain/nostr/index.types"
import {
  grantedNotificationTypes,
  grantedMethodPermissions,
  hasMethodPermission,
} from "@/domain/nwc-permission"
import { Nip47RestrictedError } from "@/domain/nostr"

type PermissionedConnection = {
  permissions: readonly NwcPermissionType[]
}

export const allowedMethods = (connection: PermissionedConnection) =>
  grantedMethodPermissions(connection.permissions)

export const enabledNotifications = (connection: PermissionedConnection) =>
  grantedNotificationTypes(connection.permissions)

export const ensureMethodPermission = (
  connection: PermissionedConnection,
  method: Nip47MethodType,
): Nip47RestrictedError | null => {
  if (hasMethodPermission(connection.permissions, method)) {
    return null
  }

  return new Nip47RestrictedError(
    `Connection does not have permission for requested operation: ${method}`,
  )
}
