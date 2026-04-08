import * as ExampleMod from "./example"
import * as ConnectionsMod from "./manage-connections"

import { wrapAsyncToRunInSpan } from "@/services/tracing"

const allFunctions = {
  Example: { ...ExampleMod },
  Connections: { ...ConnectionsMod },
} as const

let subModule: keyof typeof allFunctions
for (subModule in allFunctions) {
  for (const fn in allFunctions[subModule]) {
    /* eslint @typescript-eslint/ban-ts-comment: "off" */
    // @ts-ignore-next-line no-implicit-any error
    allFunctions[subModule][fn] = wrapAsyncToRunInSpan({
      namespace: `app.${subModule.toLowerCase()}`,
      // @ts-ignore-next-line no-implicit-any error
      fn: allFunctions[subModule][fn],
    })
  }
}

export const { Example, Connections } = allFunctions
