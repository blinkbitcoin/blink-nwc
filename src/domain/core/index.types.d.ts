export type UserId = string & { readonly brand: unique symbol }
export type WalletId = string & { readonly brand: unique symbol }
export type AccountId = string & { readonly brand: unique symbol }
export type Username = string & { readonly brand: unique symbol }
export type Satoshis = number & { readonly brand: unique symbol }
export type PrivilegedClientId = string & { readonly brand: unique symbol }
export type IpAddress = string & { readonly brand: unique symbol }
export type SessionId = string & { readonly brand: unique symbol }
export type ScopesOauth2 =
    (typeof import("./scopes").ScopesOauth2)[keyof typeof import("./scopes").ScopesOauth2]


export type Account = {
    readonly id: AccountId
    username?: Username | undefined
    kratosUserId: UserId
}
type User = {
    id: UserId
}

export type GraphQLPublicContext = {
    logger: Logger
    ip: IpAddress | undefined
    sessionId: SessionId | undefined
}

export type GraphQLPublicContextAuth = GraphQLPublicContext & {
    user: User
    domainAccount: Account
    scope: ScopesOauth2[] | undefined
    appId: string | undefined
}

export type GraphQLAdminContext = {
    logger: Logger
    privilegedClientId: PrivilegedClientId
}

export type GraphQLContext =
    | GraphQLPublicContext
    | GraphQLPublicContextAuth
    | GraphQLAdminContext
