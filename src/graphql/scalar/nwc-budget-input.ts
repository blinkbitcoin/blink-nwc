import { GT } from "@/graphql"
import NwcBudgetResetInterval from "@/graphql/scalar/nwc-budget-reset-interval";

const NwcBudgetInput = GT.Input({
    name: "NwcBudgetInput",
    fields: () => ({
        total: {
            type: GT.NonNull(GT.Int),
        },
        resetInterval: {
            type: GT.NonNull(NwcBudgetResetInterval),
        },
    }),
})
export default NwcBudgetInput
