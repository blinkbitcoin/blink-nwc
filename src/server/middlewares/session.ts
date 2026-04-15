import { NextFunction, Request, Response } from "express"
import { JwtPayload } from "jsonwebtoken"

import {
  GraphQLContext,
  IpAddress,
  ScopesOauth2,
  SessionId,
  UserId,
} from "@/domain/core/index.types"
import { checkedToUserId } from "@/domain/validation"
import { baseLogger } from "@/services/logger"

const graphqlContextLogger = baseLogger.child({
  module: "graphql-context",
})

const publicContext = ({
  tokenPayload,
}: {
  tokenPayload?: JwtPayload
}): GraphQLContext => ({
  logger: graphqlContextLogger,
  ip: undefined as IpAddress | undefined,
  sessionId:
    typeof tokenPayload?.session_id === "string"
      ? (tokenPayload.session_id as SessionId)
      : undefined,
})

const authenticatedContext = ({
  tokenPayload,
  userId,
  authorization,
}: {
  tokenPayload: JwtPayload
  userId: UserId
  authorization: string
}): GraphQLContext => ({
  ...publicContext({ tokenPayload }),
  user: { id: userId },
  authorization,
  scope:
    typeof tokenPayload.scope === "string"
      ? (tokenPayload.scope.split(" ").filter(Boolean) as ScopesOauth2[])
      : undefined,
  appId: typeof tokenPayload.client_id === "string" ? tokenPayload.client_id : undefined,
})

export const setPublicGqlContext = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const authorization = req.headers.authorization
  const tokenPayload = req.token

  if (
    typeof authorization !== "string" ||
    !tokenPayload ||
    typeof tokenPayload.sub !== "string" ||
    tokenPayload.sub === "anon"
  ) {
    req.gqlContext = publicContext({ tokenPayload })
    next()
    return
  }

  const userId = checkedToUserId(tokenPayload.sub)
  if (userId instanceof Error) {
    graphqlContextLogger.warn(
      { tokenSub: tokenPayload.sub },
      "failed to build authenticated GraphQL context from token subject",
    )
    req.gqlContext = publicContext({ tokenPayload })
    next()
    return
  }

  req.gqlContext = authenticatedContext({ tokenPayload, userId, authorization })
  next()
}
