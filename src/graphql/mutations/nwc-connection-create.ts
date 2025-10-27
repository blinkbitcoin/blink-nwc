import { GT } from "@/graphql"
import { mapAndParseErrorForGqlResponse } from "@/graphql/error-map"
import type {GraphQLPublicContextAuth} from "@/domain/core/index.types"

import WalletId from "@/graphql/scalar/wallet-id";
import Nip47Method from "@/graphql/scalar/nip47-method";
import NwcBudgetInput from "@/graphql/scalar/nwc-budget-input";
import NwcConnectionCreatePayload from "@/graphql/payload/nwc-connection-create";

import {
    WalletId as WID,
     Account
} from "@/domain/core/index.types";

import {ApiKey, Nip47Method as N47M} from "@/domain/index.types";

import {createNwcConnection} from "@/app/manage-connections";
import {NwcBudget, NwcConnectionAlias} from "@/domain/index.types";

const NwcCreateConnectionInput = GT.Input({
    name: "CreateNwcConnectionInput",
    fields: () => ({
        walletId: {
            type: GT.NonNull(WalletId),
        },
        alias: {
            type: GT.String,
        },
        apiKey: {
            type: GT.String,
        },
        permissions: {
            type: GT.NonNullList(Nip47Method),
        },
        budget: {
            type: NwcBudgetInput,
        },
    }),
})

const NwcConnectionCreateMutation = GT.Field<
    null,
    GraphQLPublicContextAuth,
    {
        input: {
            walletId: WID
            alias?: NwcConnectionAlias
            apiKey: ApiKey
            permissions: N47M[]
            budget: NwcBudget | null
        }
    }
>({
    type: GT.NonNull(NwcConnectionCreatePayload),
    args: {
        input: { type: GT.NonNull(NwcCreateConnectionInput) },
    },
    description: "Create NwcConnectionCreateMutation. Budget can't be undefined, but can be null if unlimited",
    resolve: async (_, args, { domainAccount }: { domainAccount : Account }) => {
        const { walletId, alias, budget, permissions, apiKey } = args.input
        const result = await createNwcConnection(
            domainAccount,
            walletId,
            apiKey,
            budget,
            permissions,
            alias
        );

        if (result instanceof Error) {
            return { errors: [mapAndParseErrorForGqlResponse(result)] }
        }

        return {
            errors: [],
            connectionObj: result.connectionObj,
            connectionUri: result.connectionUri,
        }
    },
})

export default NwcConnectionCreateMutation
