import { GT } from "@/graphql"

const NwcBudgetResetInterval = GT.Enum({
    name: "BudgetResetInterval",
    values: {
        DAILY: { value: "daily" },
        WEEKLY: { value: "weekly" },
        MONTHLY: { value: "monthly" },
        YEARLY: { value: "yearly" },
        NEVER: { value: "never" },
    },
})
export default NwcBudgetResetInterval
