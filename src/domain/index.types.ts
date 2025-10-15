export type ErrorLevel =
  (typeof import("./errors").ErrorLevel)[keyof typeof import("./errors").ErrorLevel]
export type AccountId = string & { readonly brand: unique symbol }
