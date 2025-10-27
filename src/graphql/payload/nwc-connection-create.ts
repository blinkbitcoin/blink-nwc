import { GraphQLObjectType } from "graphql/type";
import NwcConnection from "@/graphql/scalar/nwc-connection";
import IError from "@/graphql/abstract/error";
import {GT} from "@/graphql";

const NwcConnectionCreatePayload = new GraphQLObjectType({
  name: "NwcConnectionCreatePayload",
  fields: () => ({
    errors: {
      type: GT.NonNullList(IError),
    },
    connection: {
      type: NwcConnection,
    },
    connectionUri: {
      type: GT.String,
    },
  }),
})

export default NwcConnectionCreatePayload
