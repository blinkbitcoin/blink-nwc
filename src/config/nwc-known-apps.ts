import { NWC_KNOWN_APPS_CONFIG } from "@/config/nwc-known-apps.data"
import { NwcAppPubkey } from "@/domain/index.types"
import {
  findNwcPermissionPresetById,
  NwcPermissionPreset,
  NwcPermissionPresetIdType,
} from "@/domain/nwc-permission-preset"

export type NwcKnownApp = {
  pubkey: NwcAppPubkey
  name: string
  iconUrl: string | null
  description: string
  recommendedPreset: NwcPermissionPreset
}

type NwcKnownAppConfig = {
  pubkey: string
  name: string
  iconUrl: string | null
  description: string
  recommendedPresetId: NwcPermissionPresetIdType
}

const toKnownApp = (config: NwcKnownAppConfig): NwcKnownApp => {
  const recommendedPreset = findNwcPermissionPresetById(config.recommendedPresetId)
  if (!recommendedPreset) {
    throw new Error(`Unknown NWC permission preset: ${config.recommendedPresetId}`)
  }

  return {
    pubkey: config.pubkey as NwcAppPubkey,
    name: config.name,
    iconUrl: config.iconUrl,
    description: config.description,
    recommendedPreset,
  }
}

export const NWC_KNOWN_APPS: readonly NwcKnownApp[] =
  NWC_KNOWN_APPS_CONFIG.map(toKnownApp)

export const findKnownAppByPubkey = (pubkey: string): NwcKnownApp | null =>
  NWC_KNOWN_APPS.find((app) => app.pubkey === pubkey) ?? null
