import { GT } from "@/graphql"
import IError from "@/graphql/abstract/error";

const NwcConnectionDeletePayload = GT.Object({
  name: "NwcConnectionDeletePayload",
  fields: () => ({
    errors: {
      type: GT.NonNullList(IError),
    },
    success: {
      type: GT.NonNull(GT.Boolean),
    },
  }),
})

export default NwcConnectionDeletePayload
