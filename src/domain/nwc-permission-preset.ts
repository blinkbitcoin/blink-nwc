import { NwcPermissionType } from "@/domain/nostr/index.types"
import { Nip47Method } from "@/domain/nostr/nip47-method"
import {
  NwcNotificationType,
  toNotificationPermission,
} from "@/domain/nostr/notification-type"

export const NwcPermissionPresetId = {
  SatsbackUser: "satsback_user",
  SatsbackMerchant: "satsback_merchant",
  NostrZapper: "nostr_zapper",
  ReadOnly: "read_only",
} as const

export type NwcPermissionPresetIdType =
  (typeof NwcPermissionPresetId)[keyof typeof NwcPermissionPresetId]

export type NwcPermissionPreset = {
  id: NwcPermissionPresetIdType
  name: string
  description: string
  permissions: NwcPermissionType[]
}

export const NWC_PERMISSION_PRESETS: readonly NwcPermissionPreset[] = [
  {
    id: NwcPermissionPresetId.SatsbackUser,
    name: "Satsback User",
    description: "Earn rewards as a customer and share outgoing payment events.",
    permissions: [
      Nip47Method.MakeInvoice,
      toNotificationPermission(NwcNotificationType.PaymentSent),
    ],
  },
  {
    id: NwcPermissionPresetId.SatsbackMerchant,
    name: "Satsback Merchant",
    description: "Share incoming payment events for merchant reward matching.",
    permissions: [toNotificationPermission(NwcNotificationType.PaymentReceived)],
  },
  {
    id: NwcPermissionPresetId.NostrZapper,
    name: "Nostr Zapper",
    description: "Allow invoice payments with balance visibility for Nostr clients.",
    permissions: [Nip47Method.PayInvoice, Nip47Method.GetBalance],
  },
  {
    id: NwcPermissionPresetId.ReadOnly,
    name: "Read-Only",
    description:
      "Inspect wallet info, balance, and transactions without spending access.",
    permissions: [
      Nip47Method.GetInfo,
      Nip47Method.GetBalance,
      Nip47Method.ListTransactions,
    ],
  },
]

export const findNwcPermissionPresetById = (
  id: NwcPermissionPresetIdType,
): NwcPermissionPreset | null =>
  NWC_PERMISSION_PRESETS.find((preset) => preset.id === id) ?? null
