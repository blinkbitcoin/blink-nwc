import { Nip47MethodType as Nip47Method } from '@/domain/nostr/index.types';
import { NwcPermissionType as NwcPermission } from '@/domain/nostr/index.types';
import { NwcNotificationTypeValue as NwcNotificationType } from '@/domain/nostr/notification-type';
import { NwcPermissionPresetIdType as NwcPermissionPresetId } from '@/domain/nwc-permission-preset';
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
  UserId: { input: any; output: any; }
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
  nwcConnectionRevoke: NwcConnectionRevokePayload;
  nwcConnectionRevokeAll: NwcConnectionRevokeAllPayload;
  nwcConnectionUpdate: NwcConnectionUpdatePayload;
  nwcConnectionsRevokeAll: NwcConnectionRevokeAllPayload;
};


export type MutationNwcConnectionCreateArgs = {
  input: NwcConnectionCreateInput;
};


export type MutationNwcConnectionDeleteArgs = {
  input: NwcConnectionDeleteInput;
};


export type MutationNwcConnectionRevokeArgs = {
  input: NwcConnectionRevokeInput;
};


export type MutationNwcConnectionUpdateArgs = {
  input: NwcConnectionUpdateInput;
};

export { Nip47Method };

export type NwcBudget = {
  __typename?: 'NwcBudget';
  amountSats: Scalars['Int']['output'];
  period: NwcBudgetPeriod;
  remainingSats: Scalars['Int']['output'];
  resetsAt?: Maybe<Scalars['Timestamp']['output']>;
  usedSats: Scalars['Int']['output'];
};

export type NwcBudgetInput = {
  amountSats: Scalars['Int']['input'];
  period: NwcBudgetPeriod;
};

export const NwcBudgetPeriod = {
  Daily: 'DAILY',
  Monthly: 'MONTHLY',
  Never: 'NEVER',
  Weekly: 'WEEKLY'
} as const;

export type NwcBudgetPeriod = typeof NwcBudgetPeriod[keyof typeof NwcBudgetPeriod];
export type NwcConnection = {
  __typename?: 'NwcConnection';
  accountId: Scalars['AccountId']['output'];
  alias?: Maybe<Scalars['String']['output']>;
  appPubkey: Scalars['String']['output'];
  budget?: Maybe<NwcBudget>;
  createdAt: Scalars['Timestamp']['output'];
  expiresAt?: Maybe<Scalars['Timestamp']['output']>;
  id: Scalars['ID']['output'];
  lastUsedAt?: Maybe<Scalars['Timestamp']['output']>;
  permissions: Array<NwcPermission>;
  revoked: Scalars['Boolean']['output'];
  revokedAt?: Maybe<Scalars['Timestamp']['output']>;
  updatedAt: Scalars['Timestamp']['output'];
  userId: Scalars['UserId']['output'];
  walletCurrency: WalletCurrency;
  walletId: Scalars['WalletId']['output'];
};

export type NwcConnectionCreateInput = {
  alias?: InputMaybe<Scalars['String']['input']>;
  budget?: InputMaybe<NwcBudgetInput>;
  expiresAt?: InputMaybe<Scalars['Timestamp']['input']>;
  nwcUri: Scalars['String']['input'];
  permissions: Array<NwcPermission>;
  walletId?: InputMaybe<Scalars['WalletId']['input']>;
};

export type NwcConnectionCreatePayload = {
  __typename?: 'NwcConnectionCreatePayload';
  connection?: Maybe<NwcConnection>;
  connectionUri?: Maybe<Scalars['String']['output']>;
  errors: Array<Error>;
};

export type NwcConnectionDeleteInput = {
  connectionId: Scalars['ID']['input'];
};

export type NwcConnectionDeletePayload = {
  __typename?: 'NwcConnectionDeletePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type NwcConnectionRevokeAllPayload = {
  __typename?: 'NwcConnectionRevokeAllPayload';
  errors: Array<Error>;
  revokedCount: Scalars['Int']['output'];
};

export type NwcConnectionRevokeInput = {
  connectionId: Scalars['ID']['input'];
};

export type NwcConnectionRevokePayload = {
  __typename?: 'NwcConnectionRevokePayload';
  connection?: Maybe<NwcConnection>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type NwcConnectionUpdateInput = {
  alias?: InputMaybe<Scalars['String']['input']>;
  budget?: InputMaybe<NwcBudgetInput>;
  connectionId: Scalars['ID']['input'];
};

export type NwcConnectionUpdatePayload = {
  __typename?: 'NwcConnectionUpdatePayload';
  connection?: Maybe<NwcConnection>;
  errors: Array<Error>;
};

export type NwcKnownApp = {
  __typename?: 'NwcKnownApp';
  description: Scalars['String']['output'];
  iconUrl?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  pubkey: Scalars['String']['output'];
  recommendedPreset: NwcPermissionPreset;
};

export { NwcNotificationType };

export { NwcPermission };

export type NwcPermissionPreset = {
  __typename?: 'NwcPermissionPreset';
  description: Scalars['String']['output'];
  id: NwcPermissionPresetId;
  name: Scalars['String']['output'];
  permissions: Array<NwcPermission>;
};

export { NwcPermissionPresetId };

export type NwcServiceInfo = {
  __typename?: 'NwcServiceInfo';
  relayUrl: Scalars['String']['output'];
  serverPubkey: Scalars['String']['output'];
  supportedMethods: Array<Nip47Method>;
  supportedNotifications: Array<NwcNotificationType>;
};

export type Query = {
  __typename?: 'Query';
  hello: Scalars['String']['output'];
  nwcConnection?: Maybe<NwcConnection>;
  nwcConnections: Array<NwcConnection>;
  nwcKnownApp?: Maybe<NwcKnownApp>;
  nwcPermissionPresets: Array<NwcPermissionPreset>;
  nwcServiceInfo: NwcServiceInfo;
};


export type QueryNwcConnectionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryNwcConnectionsArgs = {
  includeRevoked?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryNwcKnownAppArgs = {
  pubkey: Scalars['String']['input'];
};

export type User = {
  __typename?: 'User';
  exampleField?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  nwcConnection?: Maybe<NwcConnection>;
  nwcConnections: Array<NwcConnection>;
};


export type UserNwcConnectionArgs = {
  id: Scalars['ID']['input'];
};


export type UserNwcConnectionsArgs = {
  includeRevoked?: InputMaybe<Scalars['Boolean']['input']>;
};

export const WalletCurrency = {
  Btc: 'BTC',
  Usd: 'USD'
} as const;

export type WalletCurrency = typeof WalletCurrency[keyof typeof WalletCurrency];
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


/** Mapping of interface types */
export type ResolversInterfaceTypes<_RefType extends Record<string, unknown>> = ResolversObject<{
  Error: ( IError );
}>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AccountId: ResolverTypeWrapper<Scalars['AccountId']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Error: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Error']>;
  GraphQLApplicationError: ResolverTypeWrapper<IError>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mutation: ResolverTypeWrapper<{}>;
  Nip47Method: Nip47Method;
  NwcBudget: ResolverTypeWrapper<NwcBudget>;
  NwcBudgetInput: NwcBudgetInput;
  NwcBudgetPeriod: NwcBudgetPeriod;
  NwcConnection: ResolverTypeWrapper<NwcConnection>;
  NwcConnectionCreateInput: NwcConnectionCreateInput;
  NwcConnectionCreatePayload: ResolverTypeWrapper<Omit<NwcConnectionCreatePayload, 'errors'> & { errors: Array<ResolversTypes['Error']> }>;
  NwcConnectionDeleteInput: NwcConnectionDeleteInput;
  NwcConnectionDeletePayload: ResolverTypeWrapper<Omit<NwcConnectionDeletePayload, 'errors'> & { errors: Array<ResolversTypes['Error']> }>;
  NwcConnectionRevokeAllPayload: ResolverTypeWrapper<Omit<NwcConnectionRevokeAllPayload, 'errors'> & { errors: Array<ResolversTypes['Error']> }>;
  NwcConnectionRevokeInput: NwcConnectionRevokeInput;
  NwcConnectionRevokePayload: ResolverTypeWrapper<Omit<NwcConnectionRevokePayload, 'errors'> & { errors: Array<ResolversTypes['Error']> }>;
  NwcConnectionUpdateInput: NwcConnectionUpdateInput;
  NwcConnectionUpdatePayload: ResolverTypeWrapper<Omit<NwcConnectionUpdatePayload, 'errors'> & { errors: Array<ResolversTypes['Error']> }>;
  NwcKnownApp: ResolverTypeWrapper<NwcKnownApp>;
  NwcNotificationType: NwcNotificationType;
  NwcPermission: NwcPermission;
  NwcPermissionPreset: ResolverTypeWrapper<NwcPermissionPreset>;
  NwcPermissionPresetId: NwcPermissionPresetId;
  NwcServiceInfo: ResolverTypeWrapper<NwcServiceInfo>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Timestamp: ResolverTypeWrapper<Scalars['Timestamp']['output']>;
  User: ResolverTypeWrapper<User>;
  UserId: ResolverTypeWrapper<Scalars['UserId']['output']>;
  WalletCurrency: WalletCurrency;
  WalletId: ResolverTypeWrapper<Scalars['WalletId']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AccountId: Scalars['AccountId']['output'];
  Boolean: Scalars['Boolean']['output'];
  Error: ResolversInterfaceTypes<ResolversParentTypes>['Error'];
  GraphQLApplicationError: IError;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Mutation: {};
  NwcBudget: NwcBudget;
  NwcBudgetInput: NwcBudgetInput;
  NwcConnection: NwcConnection;
  NwcConnectionCreateInput: NwcConnectionCreateInput;
  NwcConnectionCreatePayload: Omit<NwcConnectionCreatePayload, 'errors'> & { errors: Array<ResolversParentTypes['Error']> };
  NwcConnectionDeleteInput: NwcConnectionDeleteInput;
  NwcConnectionDeletePayload: Omit<NwcConnectionDeletePayload, 'errors'> & { errors: Array<ResolversParentTypes['Error']> };
  NwcConnectionRevokeAllPayload: Omit<NwcConnectionRevokeAllPayload, 'errors'> & { errors: Array<ResolversParentTypes['Error']> };
  NwcConnectionRevokeInput: NwcConnectionRevokeInput;
  NwcConnectionRevokePayload: Omit<NwcConnectionRevokePayload, 'errors'> & { errors: Array<ResolversParentTypes['Error']> };
  NwcConnectionUpdateInput: NwcConnectionUpdateInput;
  NwcConnectionUpdatePayload: Omit<NwcConnectionUpdatePayload, 'errors'> & { errors: Array<ResolversParentTypes['Error']> };
  NwcKnownApp: NwcKnownApp;
  NwcPermissionPreset: NwcPermissionPreset;
  NwcServiceInfo: NwcServiceInfo;
  Query: {};
  String: Scalars['String']['output'];
  Timestamp: Scalars['Timestamp']['output'];
  User: User;
  UserId: Scalars['UserId']['output'];
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
  nwcConnectionRevoke?: Resolver<ResolversTypes['NwcConnectionRevokePayload'], ParentType, ContextType, RequireFields<MutationNwcConnectionRevokeArgs, 'input'>>;
  nwcConnectionRevokeAll?: Resolver<ResolversTypes['NwcConnectionRevokeAllPayload'], ParentType, ContextType>;
  nwcConnectionUpdate?: Resolver<ResolversTypes['NwcConnectionUpdatePayload'], ParentType, ContextType, RequireFields<MutationNwcConnectionUpdateArgs, 'input'>>;
  nwcConnectionsRevokeAll?: Resolver<ResolversTypes['NwcConnectionRevokeAllPayload'], ParentType, ContextType>;
}>;

export type Nip47MethodResolvers = EnumResolverSignature<{ GET_BALANCE?: any, GET_INFO?: any, LIST_TRANSACTIONS?: any, LOOKUP_INVOICE?: any, MAKE_INVOICE?: any, PAY_INVOICE?: any }, ResolversTypes['Nip47Method']>;

export type NwcBudgetResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcBudget'] = ResolversParentTypes['NwcBudget']> = ResolversObject<{
  amountSats?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  period?: Resolver<ResolversTypes['NwcBudgetPeriod'], ParentType, ContextType>;
  remainingSats?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  resetsAt?: Resolver<Maybe<ResolversTypes['Timestamp']>, ParentType, ContextType>;
  usedSats?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NwcConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcConnection'] = ResolversParentTypes['NwcConnection']> = ResolversObject<{
  accountId?: Resolver<ResolversTypes['AccountId'], ParentType, ContextType>;
  alias?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  appPubkey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  budget?: Resolver<Maybe<ResolversTypes['NwcBudget']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Timestamp'], ParentType, ContextType>;
  expiresAt?: Resolver<Maybe<ResolversTypes['Timestamp']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastUsedAt?: Resolver<Maybe<ResolversTypes['Timestamp']>, ParentType, ContextType>;
  permissions?: Resolver<Array<ResolversTypes['NwcPermission']>, ParentType, ContextType>;
  revoked?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  revokedAt?: Resolver<Maybe<ResolversTypes['Timestamp']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Timestamp'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['UserId'], ParentType, ContextType>;
  walletCurrency?: Resolver<ResolversTypes['WalletCurrency'], ParentType, ContextType>;
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

export type NwcConnectionRevokeAllPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcConnectionRevokeAllPayload'] = ResolversParentTypes['NwcConnectionRevokeAllPayload']> = ResolversObject<{
  errors?: Resolver<Array<ResolversTypes['Error']>, ParentType, ContextType>;
  revokedCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NwcConnectionRevokePayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcConnectionRevokePayload'] = ResolversParentTypes['NwcConnectionRevokePayload']> = ResolversObject<{
  connection?: Resolver<Maybe<ResolversTypes['NwcConnection']>, ParentType, ContextType>;
  errors?: Resolver<Array<ResolversTypes['Error']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NwcConnectionUpdatePayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcConnectionUpdatePayload'] = ResolversParentTypes['NwcConnectionUpdatePayload']> = ResolversObject<{
  connection?: Resolver<Maybe<ResolversTypes['NwcConnection']>, ParentType, ContextType>;
  errors?: Resolver<Array<ResolversTypes['Error']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NwcKnownAppResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcKnownApp'] = ResolversParentTypes['NwcKnownApp']> = ResolversObject<{
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  iconUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  pubkey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  recommendedPreset?: Resolver<ResolversTypes['NwcPermissionPreset'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NwcNotificationTypeResolvers = EnumResolverSignature<{ PAYMENT_RECEIVED?: any, PAYMENT_SENT?: any }, ResolversTypes['NwcNotificationType']>;

export type NwcPermissionResolvers = EnumResolverSignature<{ GET_BALANCE?: any, GET_INFO?: any, LIST_TRANSACTIONS?: any, LOOKUP_INVOICE?: any, MAKE_INVOICE?: any, NOTIFICATIONS_PAYMENT_RECEIVED?: any, NOTIFICATIONS_PAYMENT_SENT?: any, PAY_INVOICE?: any }, ResolversTypes['NwcPermission']>;

export type NwcPermissionPresetResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcPermissionPreset'] = ResolversParentTypes['NwcPermissionPreset']> = ResolversObject<{
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['NwcPermissionPresetId'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  permissions?: Resolver<Array<ResolversTypes['NwcPermission']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NwcPermissionPresetIdResolvers = EnumResolverSignature<{ NOSTR_ZAPPER?: any, READ_ONLY?: any, SATSBACK_MERCHANT?: any, SATSBACK_USER?: any }, ResolversTypes['NwcPermissionPresetId']>;

export type NwcServiceInfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['NwcServiceInfo'] = ResolversParentTypes['NwcServiceInfo']> = ResolversObject<{
  relayUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  serverPubkey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  supportedMethods?: Resolver<Array<ResolversTypes['Nip47Method']>, ParentType, ContextType>;
  supportedNotifications?: Resolver<Array<ResolversTypes['NwcNotificationType']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  hello?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  nwcConnection?: Resolver<Maybe<ResolversTypes['NwcConnection']>, ParentType, ContextType, RequireFields<QueryNwcConnectionArgs, 'id'>>;
  nwcConnections?: Resolver<Array<ResolversTypes['NwcConnection']>, ParentType, ContextType, RequireFields<QueryNwcConnectionsArgs, 'includeRevoked'>>;
  nwcKnownApp?: Resolver<Maybe<ResolversTypes['NwcKnownApp']>, ParentType, ContextType, RequireFields<QueryNwcKnownAppArgs, 'pubkey'>>;
  nwcPermissionPresets?: Resolver<Array<ResolversTypes['NwcPermissionPreset']>, ParentType, ContextType>;
  nwcServiceInfo?: Resolver<ResolversTypes['NwcServiceInfo'], ParentType, ContextType>;
}>;

export interface TimestampScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Timestamp'], any> {
  name: 'Timestamp';
}

export type UserResolvers<ContextType = any, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = ResolversObject<{
  exampleField?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  nwcConnection?: Resolver<Maybe<ResolversTypes['NwcConnection']>, ParentType, ContextType, RequireFields<UserNwcConnectionArgs, 'id'>>;
  nwcConnections?: Resolver<Array<ResolversTypes['NwcConnection']>, ParentType, ContextType, Partial<UserNwcConnectionsArgs>>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface UserIdScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['UserId'], any> {
  name: 'UserId';
}

export interface WalletIdScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['WalletId'], any> {
  name: 'WalletId';
}

export type Resolvers<ContextType = any> = ResolversObject<{
  AccountId?: GraphQLScalarType;
  Error?: ErrorResolvers<ContextType>;
  GraphQLApplicationError?: GraphQlApplicationErrorResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Nip47Method?: Nip47MethodResolvers;
  NwcBudget?: NwcBudgetResolvers<ContextType>;
  NwcConnection?: NwcConnectionResolvers<ContextType>;
  NwcConnectionCreatePayload?: NwcConnectionCreatePayloadResolvers<ContextType>;
  NwcConnectionDeletePayload?: NwcConnectionDeletePayloadResolvers<ContextType>;
  NwcConnectionRevokeAllPayload?: NwcConnectionRevokeAllPayloadResolvers<ContextType>;
  NwcConnectionRevokePayload?: NwcConnectionRevokePayloadResolvers<ContextType>;
  NwcConnectionUpdatePayload?: NwcConnectionUpdatePayloadResolvers<ContextType>;
  NwcKnownApp?: NwcKnownAppResolvers<ContextType>;
  NwcNotificationType?: NwcNotificationTypeResolvers;
  NwcPermission?: NwcPermissionResolvers;
  NwcPermissionPreset?: NwcPermissionPresetResolvers<ContextType>;
  NwcPermissionPresetId?: NwcPermissionPresetIdResolvers;
  NwcServiceInfo?: NwcServiceInfoResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Timestamp?: GraphQLScalarType;
  User?: UserResolvers<ContextType>;
  UserId?: GraphQLScalarType;
  WalletId?: GraphQLScalarType;
}>;

