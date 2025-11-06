import {CannotConnectToDbError, RepositoryError, UnknownRepositoryError} from "@/domain/errors";
import {parseErrorMessageFromUnknown} from "@/domain/error-parsers";

export * from "./query-builder"
export * from "./connections"


export const parseRepositoryError = (err: unknown) => {
    const errMsg = parseErrorMessageFromUnknown(err)
    switch (errMsg) {
        case KnownDbErrorDetails.InvalidDatabase:
        case KnownDbErrorDetails.InvalidConnection:
        case KnownDbErrorDetails.InvalidCredentials:
            return new CannotConnectToDbError()
        default:
            return new UnknownRepositoryError();
    }
}
export const KnownDbErrorDetails = {
    InvalidConnection: "ECONNREFUSED",
    InvalidCredentials: "28P01",
    InvalidDatabase: "3D000",
} as const
