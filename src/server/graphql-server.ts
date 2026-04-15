import { createServer } from "http"

import PinoHttp from "pino-http"
import { ApolloServer, ApolloError } from "apollo-server-express"
import helmet from "helmet"
import express, { NextFunction, Request, RequestHandler, Response } from "express"
import {
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from "apollo-server-core"
import { GraphQLError, GraphQLSchema } from "graphql"
import jsonwebtoken from "jsonwebtoken"
import jwksRsa from "jwks-rsa"

import {
  APOLLO_PLAYGROUND_ENABLED,
  NODE_ENV,
  OATHKEEPER_DECISION_ENDPOINT,
} from "@/config"
import { baseLogger } from "@/services/logger"

const graphqlLogger = baseLogger.child({
  module: "graphql",
})

const jwtAlgorithms: jsonwebtoken.Algorithm[] = ["RS256"]
const jwksClient = jwksRsa({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: `${OATHKEEPER_DECISION_ENDPOINT}/.well-known/jwks.json`,
})
type RequestLogMetadata = Request & {
  id?: string
  remoteAddress?: string
}

const SENSITIVE_LOG_KEYS = new Set([
  "accessToken",
  "apiKey",
  "apiKeySecret",
  "authorization",
  "authToken",
  "code",
  "connectionSecret",
  "connectionUri",
  "invoice",
  "nwcUri",
  "secret",
  "token",
])

const sanitizeForLog = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item))
  }

  if (!value || typeof value !== "object") {
    return value
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      SENSITIVE_LOG_KEYS.has(key) ? "[redacted]" : sanitizeForLog(nestedValue),
    ]),
  )
}

const summarizeGraphqlBody = (body: unknown) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined
  }

  const gqlBody = body as {
    operationName?: unknown
    variables?: unknown
  }

  return {
    operationName:
      typeof gqlBody.operationName === "string" ? gqlBody.operationName : undefined,
    variables: sanitizeForLog(gqlBody.variables),
  }
}

const summarizeGqlContext = (gqlContext?: Request["gqlContext"]) => {
  if (!gqlContext) {
    return undefined
  }

  return {
    userId: "user" in gqlContext ? gqlContext.user?.id : undefined,
    hasAuthorization:
      "authorization" in gqlContext ? Boolean(gqlContext.authorization) : false,
    appId: "appId" in gqlContext ? gqlContext.appId : undefined,
  }
}

const getSigningKey = async (kid?: string) => {
  if (!kid) {
    throw new Error("Missing JWT kid")
  }

  const signingKey = await jwksClient.getSigningKey(kid)
  return signingKey.getPublicKey()
}

const verifyJwt = async (token: string): Promise<jsonwebtoken.JwtPayload> => {
  const decoded = jsonwebtoken.decode(token, { complete: true })
  if (!decoded || typeof decoded === "string") {
    throw new Error("Invalid JWT header")
  }

  const publicKey = await getSigningKey(decoded.header.kid)
  const payload = jsonwebtoken.verify(token, publicKey, {
    algorithms: jwtAlgorithms,
    issuer: "galoy.io",
  })

  if (typeof payload === "string") {
    throw new Error("Unexpected JWT payload")
  }

  return payload
}

const authenticationMiddleware: RequestHandler = async (req, res, next) => {
  const authorization = req.headers.authorization

  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    next()
    return
  }

  const token = authorization.slice("Bearer ".length).trim()
  if (token.length === 0) {
    next()
    return
  }

  try {
    req.token = await verifyJwt(token)
    next()
  } catch (err) {
    graphqlLogger.warn({ err }, "failed to verify GraphQL JWT")
    res.status(401).json({
      errors: [
        {
          message: "Unauthorized",
          code: "UNAUTHENTICATED",
        },
      ],
    })
  }
}

export const startApolloServer = async ({
  schema,
  port,
  type,
  setGqlContext,
}: {
  schema: GraphQLSchema
  port: string | number
  type: string
  setGqlContext: (req: Request, res: Response, next: NextFunction) => Promise<void>
}): Promise<Record<string, unknown>> => {
  const app = express()
  const httpServer = createServer(app)

  const apolloServer = new ApolloServer({
    schema,
    cache: "bounded",
    plugins: [
      APOLLO_PLAYGROUND_ENABLED
        ? ApolloServerPluginLandingPageGraphQLPlayground({
            settings: { "schema.polling.enable": false },
          })
        : ApolloServerPluginLandingPageDisabled(),
    ],
    context: async ({ req }) => req.gqlContext ?? {},
    introspection: NODE_ENV === "development",
    formatError: (err) => {
      const reportErrorToClient =
        err instanceof ApolloError || err instanceof GraphQLError

      const reportedError = {
        message: err.message,
        locations: err.locations,
        path: err.path,
        code: err.extensions?.code,
      }

      return reportErrorToClient
        ? reportedError
        : { message: `Error processing GraphQL request ${reportedError.code}` }
    },
  })

  const enablePolicy = APOLLO_PLAYGROUND_ENABLED ? false : undefined

  app.use(
    helmet({
      crossOriginEmbedderPolicy: enablePolicy,
      crossOriginOpenerPolicy: enablePolicy,
      crossOriginResourcePolicy: enablePolicy,
      contentSecurityPolicy: enablePolicy,
    }),
  )

  app.get("/healthz", (_req, res) => {
    res.status(200).send("ok")
  })

  app.use(
    PinoHttp({
      logger: graphqlLogger,
      wrapSerializers: true,
      customProps: (req: Request) => ({
        body: summarizeGraphqlBody(req.body),
        gqlContext: summarizeGqlContext(req.gqlContext),
        tokenSub: req.token?.sub,
      }),
      autoLogging: {
        ignore: (req) => req.url === "/healthz",
      },
      serializers: {
        res: (res) => ({ statusCode: res.statusCode }),
        req: (req) => ({
          id: (req as RequestLogMetadata).id,
          method: req.method,
          url: req.url,
          remoteAddress: (req as RequestLogMetadata).remoteAddress,
        }),
      },
    }),
  )

  app.use("/graphql", authenticationMiddleware)
  app.use("/graphql", setGqlContext)

  await apolloServer.start()

  apolloServer.applyMiddleware({
    app: app as Parameters<typeof apolloServer.applyMiddleware>[0]["app"],
    path: "/graphql",
    cors: { credentials: true, origin: true },
  })

  return new Promise((resolve, reject) => {
    httpServer.listen({ port }, () => {
      console.log(`🚀 Server ready at http://localhost:${port}/graphql`)
      console.log(`🚀 ${type} GraphQL server listening on /graphql`)
      resolve({ app, httpServer, apolloServer })
    })

    httpServer.on("error", (err) => {
      console.error(err)
      reject(err)
    })
  })
}
