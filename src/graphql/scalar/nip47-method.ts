import { GT } from "@/graphql"

const Nip47Method = GT.Enum({
    name: "Nip47Method",
    values: {
        GET_INFO: { value: "get_info" },
        GET_BALANCE: { value: "get_balance" },
        MAKE_INVOICE: { value: "make_invoice" },
        PAY_INVOICE: { value: "pay_invoice" },
        LOOKUP_INVOICE: { value: "lookup_invoice" },
        LIST_TRANSACTIONS: { value: "list_transactions" },
    },
})
export default Nip47Method
