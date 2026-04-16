import type { NwcKnownAppConfig } from "@/config/nwc-known-apps"
import { NwcPermissionPresetId } from "@/domain/nwc-permission-preset"

export const NWC_KNOWN_APPS_CONFIG = [
  {
    pubkey: "2222222222222222222222222222222222222222222222222222222222222222",
    name: "Satsback",
    iconUrl: "https://assets.example.com/apps/satsback.png",
    description: "Bitcoin cashback rewards paid in satoshis.",
    recommendedPresetId: NwcPermissionPresetId.SatsbackUser,
  },
] as const satisfies readonly NwcKnownAppConfig[]
