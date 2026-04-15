// globally used types
type Logger = import("pino").Logger

declare namespace Express {
  export interface Request {
    gqlContext?: import("@/domain/core/index.types").GraphQLContext
    token?: import("jsonwebtoken").JwtPayload
  }
}
