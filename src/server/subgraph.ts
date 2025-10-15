import { readFileSync } from "fs"

import { createServer } from "http"

import PinoHttp from "pino-http"
import { ApolloServer, ApolloError } from "apollo-server-express"
import { buildSubgraphSchema } from "@apollo/subgraph"
import { gql } from "graphql-tag"
import express from "express"
import helmet from "helmet"

import {
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from "apollo-server-core"

import { GraphQLError, GraphQLSchema } from "graphql"

import { resolvers } from "../graphql"

import { NODE_ENV } from "../config"

import { baseLogger } from "@/services/logger"
import { APOLLO_PLAYGROUND_ENABLED, SUBGRAPH_PORT } from "@/config/index"

const graphqlLogger = baseLogger.child({
  module: "graphql",
})

const typeDefsString = readFileSync("./src/graphql/schema.graphql", { encoding: "utf-8" })
const typeDefs = gql(typeDefsString)

const schema = buildSubgraphSchema({ typeDefs, resolvers })

export const startApolloServer = async ({
  schema,
  port,
}: {
  schema: GraphQLSchema
  port: string | number
}): Promise<Record<string, unknown>> => {
  const app = express()
  const httpServer = createServer(app)

  const apolloPlugins = [
    APOLLO_PLAYGROUND_ENABLED
      ? ApolloServerPluginLandingPageGraphQLPlayground({
          settings: { "schema.polling.enable": false },
        })
      : ApolloServerPluginLandingPageDisabled(),
  ]

  const apolloServer = new ApolloServer({
    schema,
    cache: "bounded",
    plugins: apolloPlugins,
    introspection: NODE_ENV === "development" ? true : false,
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

  app.use(
    PinoHttp({
      logger: graphqlLogger,
      wrapSerializers: true,
      customProps: (req: any) => {
        return {
          body: req.body,
        }
      },
      autoLogging: {
        ignore: (req) => req.url === "/healthz",
      },
      serializers: {
        res: (res) => ({ statusCode: res.statusCode }),
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
          // headers: req.headers,
        }),
      },
    }),
  )

  await apolloServer.start()

  apolloServer.applyMiddleware({
    app: app as any,
    path: "/graphql",
    cors: { credentials: true, origin: true },
  })

  return new Promise((resolve, reject) => {
    httpServer.listen({ port }, () => {
      console.log(
        `🚀 Server ready at http://localhost:${port}${apolloServer.graphqlPath}`,
      )

      resolve({ app, httpServer, apolloServer })
    })

    httpServer.on("error", (err) => {
      console.error(err)
      reject(err)
    })
  })
}

startApolloServer({ schema, port: SUBGRAPH_PORT })
