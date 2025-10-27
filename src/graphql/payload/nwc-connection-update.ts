import { GT } from "@/graphql"
import IError from "@/graphql/abstract/error";
import NwcConnection from "@/graphql/scalar/nwc-connection";

const NwcConnectionUpdatePayload = GT.Object({
  name: "NwcConnectionUpdatePayload",
  fields: () => ({
    errors: {
      type: GT.NonNullList(IError),
    },
    connection: {
      type: NwcConnection,
    },
  }),
})

export default NwcConnectionUpdatePayload
