import { readFileSync } from "fs"

import { buildSubgraphSchema } from "@apollo/subgraph"
import { gql } from "graphql-tag"

import { startApolloServer } from "./graphql-server"

import { setPublicGqlContext } from "./middlewares/session"

import { resolvers } from "@/graphql"
import { SUBGRAPH_PORT } from "@/config"

const typeDefsString = readFileSync("./src/graphql/schema.graphql", { encoding: "utf-8" })
const typeDefs = gql(typeDefsString)

const schema = buildSubgraphSchema({ typeDefs, resolvers })

export const startApolloServerForNwcSchema = () =>
  startApolloServer({
    schema,
    port: SUBGRAPH_PORT,
    type: "nwc",
    setGqlContext: setPublicGqlContext,
  })

if (require.main === module) {
  startApolloServerForNwcSchema().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
