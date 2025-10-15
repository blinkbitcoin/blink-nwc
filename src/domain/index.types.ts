export type ErrorLevel =
  (typeof import("./errors").ErrorLevel)[keyof typeof import("./errors").ErrorLevel]
