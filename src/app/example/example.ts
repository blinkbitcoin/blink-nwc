import { COMMITHASH } from "@/config"
import { recordExceptionInCurrentSpan } from "@/services/tracing"
import { ErrorLevel } from "@/domain/errors"
import { ExampleError } from "@/domain/example/errors"

export const hello = async () => {
  if (!COMMITHASH) {
    recordExceptionInCurrentSpan({
      error: "missing COMMITHASH",
      level: ErrorLevel.Critical,
    })
    return new ExampleError("missing COMMITHASH")
  }

  console.log(`hello from example module! commit: ${COMMITHASH}`)

  return `Hello from GraphQL Subgraph!`
}
