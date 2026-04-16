import { NWC_KNOWN_APPS_CONFIG } from "@/config/nwc-known-apps.data"
import { InvalidNwcKnownAppConfig } from "@/domain/errors"
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

export type NwcKnownAppConfig = {
  pubkey: string
  name: string
  iconUrl: string | null
  description: string
  recommendedPresetId: NwcPermissionPresetIdType
}

const KNOWN_APP_PUBKEY_REGEX = /^[0-9a-f]{64}$/i
const PLACEHOLDER_KNOWN_APP_PUBKEYS = new Set([
  "2222222222222222222222222222222222222222222222222222222222222222",
])

const normalizeKnownAppPubkey = (pubkey: string): NwcAppPubkey | null => {
  const normalized = pubkey.trim().toLowerCase()
  if (!KNOWN_APP_PUBKEY_REGEX.test(normalized)) {
    return null
  }

  return normalized as NwcAppPubkey
}

const toKnownApp = (config: NwcKnownAppConfig): NwcKnownApp => {
  const recommendedPreset = findNwcPermissionPresetById(config.recommendedPresetId)
  if (!recommendedPreset) {
    throw new InvalidNwcKnownAppConfig(
      `Unknown NWC permission preset: ${config.recommendedPresetId}`,
    )
  }

  const normalizedPubkey = normalizeKnownAppPubkey(config.pubkey)
  if (!normalizedPubkey) {
    throw new InvalidNwcKnownAppConfig(`Invalid NWC app pubkey: ${config.pubkey}`)
  }

  if (
    process.env.NODE_ENV === "production" &&
    PLACEHOLDER_KNOWN_APP_PUBKEYS.has(normalizedPubkey)
  ) {
    throw new InvalidNwcKnownAppConfig(
      `Known app ${config.name} uses a placeholder pubkey in production`,
    )
  }

  return {
    pubkey: normalizedPubkey,
    name: config.name,
    iconUrl: config.iconUrl,
    description: config.description,
    recommendedPreset,
  }
}

export const NWC_KNOWN_APPS: readonly NwcKnownApp[] =
  NWC_KNOWN_APPS_CONFIG.map(toKnownApp)

export const findKnownAppByPubkey = (pubkey: string): NwcKnownApp | null => {
  const normalizedPubkey = normalizeKnownAppPubkey(pubkey)
  if (!normalizedPubkey) {
    return null
  }

  return NWC_KNOWN_APPS.find((app) => app.pubkey === normalizedPubkey) ?? null
}
