import { GT } from "@/graphql"
import Timestamp from "@/graphql/scalar/timestamp";
import NwcBudgetResetInterval from "@/graphql/scalar/nwc-budget-reset-interval";

import {NwcBudget} from "@/domain/index.types"
const NwcBudget = GT.Object<NwcBudget>({
    name: "NwcBudget",
    fields: () => ({
        total: {
            type: GT.NonNull(GT.Int),
        },
        spent: {
            type: GT.NonNull(GT.Int),
        },
        resetInterval: {
            type: GT.NonNull(NwcBudgetResetInterval),
        },
        lastReset: {
            type: GT.NonNull(Timestamp),
        },
    }),
})

export default NwcBudget
