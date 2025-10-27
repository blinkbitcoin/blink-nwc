import { GT } from "@/graphql"
import { mapAndParseErrorForGqlResponse } from "@/graphql/error-map"
import {NwcConnectionId} from "@/domain/index.types";
import NwcConnectionDeletePayload from "@/graphql/payload/nwc-connection-delete";
import {softDeleteNwcConnection} from "@/app/manage-connections";
import {Account, GraphQLPublicContextAuth} from "@/domain/core/index.types";

const NwcConnectionDeleteInput = GT.Input({
    name: "NwcConnectionDeleteInput",
    fields: () => ({
        connectionId: {
            type: GT.NonNull(String),
        },
    }),
})

const NwcConnectionDeleteMutation = GT.Field<
    null,
    GraphQLPublicContextAuth,
    {
        input: {
            connectionId: NwcConnectionId
        }
    }
>({
    type: GT.NonNull(NwcConnectionDeletePayload),
    args: {
        input: { type: GT.NonNull(NwcConnectionDeleteInput) },
    },
    resolve: async (_, args, {domainAccount}: {domainAccount: Account}) => {
        const { connectionId } = args.input

        const result = await softDeleteNwcConnection(domainAccount, connectionId)

        if (result instanceof Error) {
            return { errors: [mapAndParseErrorForGqlResponse(result)], success: false }
        }

        return {
            errors: [],
            success: result,
        }
    },
})

export default NwcConnectionDeleteMutation
