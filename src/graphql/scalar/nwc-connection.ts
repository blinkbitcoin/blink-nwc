import { GT } from "@/graphql"
import type {NwcConnection} from "@/domain/nwc-connection";
import WalletId from "@/graphql/scalar/wallet-id";
import NwcBudget from "@/graphql/scalar/nwc-budget";
import Timestamp from "@/graphql/scalar/timestamp";
import Nip47Method from "@/graphql/scalar/nip47-method";

const NwcConnection = GT.Object<NwcConnection>({
    name: "NwcConnection",
    fields: () => {
        return {
            id: {
                type: GT.NonNull(GT.ID),
            },
            alias: {
                type: GT.String,
            },
            walletId: {
                type: GT.NonNull(WalletId),
            },
            appPubkey: {
                type: GT.NonNull(GT.String),
            },
            permissions: {
                type: GT.NonNullList(Nip47Method),
            },
            budget: {
                type: NwcBudget,
            },
            createdAt: {
                type: GT.NonNull(Timestamp),
            },
            updatedAt: {
                type: GT.NonNull(Timestamp),
            },
        }
    },
})

export default NwcConnection
