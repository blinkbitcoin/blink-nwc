import { Nip47Response, Nip47Result } from "@/domain/index.types"
import { Nip47Error } from "@/domain/nip47-errors"

export * from "./connection"
export * from "./nip47-errors"
export * from "./nip47-types"
export * from "./methods"
export * from "./event-kinds"
export * from "./validation"
export * from "./encryption"

export const parseNip47Response = (res: Nip47Result | Nip47Error): Nip47Response => {
  if (res instanceof Nip47Error) {
    return { error: { code: res.code, message: res.message } }
  }
  return { result: res }
}
