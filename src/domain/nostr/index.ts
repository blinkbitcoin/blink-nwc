import { Nip47Response, Nip47Result } from "@/domain/nostr/index.types"
import { Nip47Error } from "@/domain/nostr/errors"

export * from "./encryption"
export * from "./errors"
export * from "./event-kinds"
export * from "./methods"

export const parseNip47Response = (res: Nip47Result | Nip47Error): Nip47Response => {
  if (res instanceof Nip47Error) {
    return { error: { code: res.code, message: res.message } }
  }
  return { result: res }
}
