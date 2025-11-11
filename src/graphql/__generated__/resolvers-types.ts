import { Nip47Method } from '@/domain/methods';
import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { IError } from '@/graphql/index.types';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
export type EnumResolverSignature<T, AllowedValues = any> = { [key in keyof T]?: AllowedValues };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  AccountId: { input: any; output: any; }
  Timestamp: { input: any; output: any; }
  WalletId: { input: any; output: any; }
};

export type Error = {
  code?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  path?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
};

export type GraphQlApplicationError = Error & {
  __typename?: 'GraphQLApplicationError';
  code?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  path?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
};

export type Mutation = {
  __typename?: 'Mutation';
  nwcConnectionCreate: NwcConnectionCreatePayload;
  nwcConnectionDelete: NwcConnectionDeletePayload;
  nwcConnectionUpdate: NwcConnectionUpdatePayload;
};


export type MutationNwcConnectionCreateArgs = {
  input: NwcConnectionCreateInput;
};


export type MutationNwcConnectionDeleteArgs = {
  input: NwcConnectionDeleteInput;
};


export type MutationNwcConnectionUpdateArgs = {
  input: NwcConnectionUpdateInput;
};

export { Nip47Method };

export type NwcConnection = {
  __typename?: 'NwcConnection';
  accountId: Scalars['AccountId']['output'];
  alias?: Maybe<Scalars['String']['output']>;
  appPubkey: Scalars['String']['output'];
  createdAt: Scalars['Timestamp']['output'];
  id: Scalars['ID']['output'];
  permissions: Array<Nip47Method>;
  updatedAt: Scalars['Timestamp']['output'];
  walletId: Scalars['WalletId']['output'];
};

export type NwcConnectionCreateInput = {
  alias?: InputMaybe<Scalars['String']['input']>;
  apiKey: Scalars['String']['input'];
  permissions: Array<Nip47Method>;
  walletId: Scalars['WalletId']['input'];
};

export type NwcConnectionCreatePayload = {
  __typename?: 'NwcConnectionCreatePayload';
  connection?: Maybe<NwcConnection>;
  connectionUri?: Maybe<Scalars['String']['output']>;
  errors: Array<Error>;
};

export type NwcConnectionDeleteInput = {
  id: Scalars['ID']['input'];
};

export type NwcConnectionDeletePayload = {
  __typename?: 'NwcConnectionDeletePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type NwcConnectionUpdateInput = {
  alias?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  permissions?: InputMaybe<Array<Nip47Method>>;
};

export type NwcConnectionUpdatePayload = {
  __typename?: 'NwcConnectionUpdatePayload';
  connection?: Maybe<NwcConnection>;
  errors: Array<Error>;
};

export type Query = {
  __typename?: 'Query';
  hello: Scalars['String']['output'];
};

export type User = {
  __typename?: 'User';
  exampleField?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  nwcConnections: Array<NwcConnection>;
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AccountId: ResolverTypeWrapper<Scalars['AccountId']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Error: ResolverTypeWrapper<IError>;
  GraphQLApplicationError: ResolverTypeWrapper<GraphQlApplicationError>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Mutation: ResolverTypeWrapper<{}>;
  Nip47Method: Nip47Method;
  NwcConnection: ResolverTypeWrapper<NwcConnection>;
  NwcConnectionCreateInput: NwcConnectionCreateInput;
  NwcConnectionCreatePayload: ResolverTypeWrapper<Omit<NwcConnectionCreatePayload, 'errors'> & { errors: Array<ResolversTypes['Error']> }>;
  NwcConnectionDeleteInput: NwcConnectionDeleteInput;
  NwcConnectionDeletePayload: ResolverTypeWrapper<Omit<NwcConnectionDeletePayload, 'errors'> & { errors: Array<ResolversTypes['Error']> }>;
  NwcConnectionUpdateInput: NwcConnectionUpdateInput;
  NwcConnectionUpdatePayload: ResolverTypeWrapper<Omit<NwcConnectionUpdatePayload, 'errors'> & { errors: Array<ResolversTypes['Error']> }>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Timestamp: ResolverTypeWrapper<Scalars['Timestamp']['output']>;
  User: ResolverTypeWrapper<User>;
  WalletId: ResolverTypeWrapper<Scalars['WalletId']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AccountId: Scalars['AccountId']['output'];
  Boolean: Scalars['Boolean']['output'];
  Error: IError;
  GraphQLApplicationError: GraphQlApplicationError;
  ID: Scalars['ID']['output'];
  Mutation: {};
  NwcConnection: NwcConnection;
  NwcConnectionCreateInput: NwcConnectionCreateInput;
  NwcConnectionCreatePayload: Omit<NwcConnectionCreatePayload, 'errors'> & { errors: Array<ResolversParentTypes['Error']> };
  NwcConnectionDeleteInput: NwcConnectionDeleteInput;
  NwcConnectionDeletePayload: Omit<NwcConnectionDeletePayload, 'errors'> & { errors: Array<ResolversParentTypes['Error']> };
  NwcConnectionUpdateInput: NwcConnectionUpdateInput;
  NwcConnectionUpdatePayload: Omit<NwcConnectionUpdatePayload, 'errors'> & { errors: Array<ResolversParentTypes['Error']> };
  Query: {};
  String: Scalars['String']['output'];
  Timestamp: Scalars['Timestamp']['output'];
  User: User;
  WalletId: Scalars['WalletId']['output'];
}>;

export interface AccountIdScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['AccountId'], any> {
  name: 'AccountId';
}

export type ErrorResolvers<ContextType = any, ParentType extends ResolversParentTypes['Error'] = ResolversParentTypes['Error']> = ResolversObject<{
  __resolveType: TypeResolveFn<'GraphQLApplicationError', ParentType, ContextType>;
  code?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  path?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
}>;

export type GraphQlApplicationErrorResolvers<ContextType = any, ParentType extends ResolversParentTypes['GraphQLApplicationError'] = ResolversParentTypes['GraphQLApplicationError']> = ResolversObject<{
  code?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  path?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  nwcConnectionCreate?: Resolver<ResolversTypes['NwcConnectionCreatePayload'], ParentType, ContextType, RequireFields<MutationNwcConnectionCreateArgs, 'input'>>;
  nwcConnectionDelete?: Resolver<ResolversTypes['NwcConnectionDeletePayload'], ParentType, ContextType, RequireFields<MutationNwcConnectionDeleteArgs, 'input'>>;
  nwcConnectionUpdate?: Resolver<ResolversTypes['NwcConnectionUpdatePayload'], ParentType, ContextType, RequireFields<MutationNwcConnectionUpdateArgs, 'input'>>;
}>;

export type Nip47MethodResolvers = EnumResolverSignature<{ GET_BALANCE?: any, GET_INFO?: any, LIST_TRANSACTIONS?: any, LOOKUP_INVOICE?: any, MAKE_INVOICE?: any, PAY_INVOICE?: any }, ResolversTypes['Nip47Method']>;

export type NwcConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcConnection'] = ResolversParentTypes['NwcConnection']> = ResolversObject<{
  accountId?: Resolver<ResolversTypes['AccountId'], ParentType, ContextType>;
  alias?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  appPubkey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Timestamp'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  permissions?: Resolver<Array<ResolversTypes['Nip47Method']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Timestamp'], ParentType, ContextType>;
  walletId?: Resolver<ResolversTypes['WalletId'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NwcConnectionCreatePayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcConnectionCreatePayload'] = ResolversParentTypes['NwcConnectionCreatePayload']> = ResolversObject<{
  connection?: Resolver<Maybe<ResolversTypes['NwcConnection']>, ParentType, ContextType>;
  connectionUri?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  errors?: Resolver<Array<ResolversTypes['Error']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NwcConnectionDeletePayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcConnectionDeletePayload'] = ResolversParentTypes['NwcConnectionDeletePayload']> = ResolversObject<{
  errors?: Resolver<Array<ResolversTypes['Error']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NwcConnectionUpdatePayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcConnectionUpdatePayload'] = ResolversParentTypes['NwcConnectionUpdatePayload']> = ResolversObject<{
  connection?: Resolver<Maybe<ResolversTypes['NwcConnection']>, ParentType, ContextType>;
  errors?: Resolver<Array<ResolversTypes['Error']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  hello?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export interface TimestampScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Timestamp'], any> {
  name: 'Timestamp';
}

export type UserResolvers<ContextType = any, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = ResolversObject<{
  exampleField?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  nwcConnections?: Resolver<Array<ResolversTypes['NwcConnection']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface WalletIdScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['WalletId'], any> {
  name: 'WalletId';
}

export type Resolvers<ContextType = any> = ResolversObject<{
  AccountId?: GraphQLScalarType;
  Error?: ErrorResolvers<ContextType>;
  GraphQLApplicationError?: GraphQlApplicationErrorResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Nip47Method?: Nip47MethodResolvers;
  NwcConnection?: NwcConnectionResolvers<ContextType>;
  NwcConnectionCreatePayload?: NwcConnectionCreatePayloadResolvers<ContextType>;
  NwcConnectionDeletePayload?: NwcConnectionDeletePayloadResolvers<ContextType>;
  NwcConnectionUpdatePayload?: NwcConnectionUpdatePayloadResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Timestamp?: GraphQLScalarType;
  User?: UserResolvers<ContextType>;
  WalletId?: GraphQLScalarType;
}>;

