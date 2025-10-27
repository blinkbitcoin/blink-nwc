import { GT } from "@/graphql"
import Nip47Method from "@/graphql/scalar/nip47-method";
import NwcBudgetInput from "@/graphql/scalar/nwc-budget-input";
import {
  NwcConnectionAlias,
  NwcConnectionId,
  Nip47Method as N47M, NwcBudget
} from "@/domain/index.types";
import NwcConnectionUpdatePayload from "@/graphql/payload/nwc-connection-update";
import {updateNwcConnection} from "@/app/manage-connections";
import {mapAndParseErrorForGqlResponse} from "@/graphql/error-map";
import {Account, GraphQLPublicContextAuth} from "@/domain/core/index.types";


const UpdateNwcConnectionInput = GT.Input({
  name: "UpdateNwcConnectionInput",
  fields: () => ({
    id: {
      type: GT.NonNull(GT.ID),
    },
    alias: {
      type: GT.String,
    },
    permissions: {
      type: GT.List(Nip47Method),
    },
    budget: {
      type: NwcBudgetInput,
    },
  }),
})

const NwcConnectionUpdateMutation = GT.Field<
  null,
  GraphQLPublicContextAuth,
  {
    input: {
      connectionId: NwcConnectionId // required
      alias?: NwcConnectionAlias
      permissions?: N47M[]
      budget?: NwcBudget | null // if null - delete budget option.
    }
  }
>({
  type: GT.NonNull(NwcConnectionUpdatePayload),
  args: {
    input: { type: GT.NonNull(UpdateNwcConnectionInput) },
  },
  resolve: async (_, args, { domainAccount }: { domainAccount: Account }) => {

    const { connectionId, alias, permissions, budget } = args.input
    const connection = await updateNwcConnection(
        domainAccount,
        connectionId,
        {
          alias,
          permissions,
          budget,
        }
    )

    if (connection instanceof Error) {
      return { errors: [mapAndParseErrorForGqlResponse(connection)] }
    }

    return {
      errors: [],
      connection,
    }
  },
})

export default NwcConnectionUpdateMutation
