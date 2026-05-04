import { ApolloClient, ApolloLink, InMemoryCache, HttpLink } from "@apollo/client"

import { PUBLIC_GRAPHQL_URL, ROUTER_URL } from "@/config"

const authLink = new ApolloLink((operation, forward) => {
  const { apiKey, authorization } = operation.getContext()
  operation.setContext({
    headers: {
      ...(apiKey ? { "X-API-KEY": apiKey } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
    },
  })
  return forward(operation)
})

export const httpLink = new HttpLink({
  uri: (operation) => {
    const { uri, apiKey } = operation.getContext()
    if (typeof uri === "string" && uri.length > 0) {
      return uri
    }

    return apiKey ? PUBLIC_GRAPHQL_URL : ROUTER_URL
  },
})

const client = new ApolloClient({
  link: ApolloLink.from([authLink, httpLink]),
  cache: new InMemoryCache(),
})

export default client
