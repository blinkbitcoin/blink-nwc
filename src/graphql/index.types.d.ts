type GraphQLError = import("graphql").GraphQLError
type InputValidationError = import("./errors").InputValidationError

type IError = {
  message: string
  readonly path: ReadonlyArray<string | number> | undefined
  code?: string
}

type LogFn = import("pino").LogFn

type CustomGraphQLError = import("./errors").CustomGraphQLError

type CustomGraphQLErrorData = {
  message?: string
  logger: Logger
  level?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent"
  forwardToClient?: boolean
  [key: string]: unknown
}

type GraphQLResult<T> = {
  errors: GraphQLError[]
  data: T
}

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ReadonlyArray<T> {
  includes<S, R extends `${Extract<S, string>}`>(
    this: ReadonlyArray<R>,
    searchElement: S,
    fromIndex?: number,
  ): searchElement is R & S
}
