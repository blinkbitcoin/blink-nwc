import { getPublicKey, generateSecretKey } from "nostr-tools"
import {
    NwcBudget,
    Nip47Method,
    NwcConnectionAlias,
    NwcUri,
    NwcSecret, NwcAppPubkey, NwcConnectionId, ApiKey,
} from "@/domain/index.types"
import {
    checkedToUserId,
    checkedToWalletId,
    checkedToBudget,
    checkedToPermissions,
    checkedToNwcAlias,
    checkedToConnectionId,
    checkedToNwcUpdates,
} from "@/domain/validation"
import {getServerKeypair, NwcConnection, stringifyNwcUri} from "@/domain/nwc-connection";
import {ConnectionsRepository} from "@/services/db/connections";
import {NOSTR_RELAY_URL} from "@/config";
import {Account, WalletId} from "@/domain/core/index.types";

export const createNwcConnection = async (
    account: Account,
    walletId: WalletId,
    apiKey: ApiKey,
    budget: NwcBudget | null,
    permissions: Nip47Method[],
    alias?: NwcConnectionAlias,
): Promise<
    { connectionObj: NwcConnection; connectionUri: NwcUri } | ApplicationError
> => {

    const checkedWalletId = checkedToWalletId(walletId)
    if (checkedWalletId instanceof Error) {
        return checkedWalletId
    }

    const checkedBudget = checkedToBudget(budget)
    if (checkedBudget instanceof Error) {
        return checkedBudget
    }

    const checkedPermissions = checkedToPermissions(permissions)
    if (checkedPermissions instanceof Error) {
        return checkedPermissions
    }

    const checkedAlias = checkedToNwcAlias(alias)
    if (checkedAlias instanceof Error) {
        return checkedAlias
    }


    const bytes = generateSecretKey()
    const secret = Buffer.from(bytes).toString("hex") as NwcSecret
    const appPubkey = getPublicKey(bytes) as NwcAppPubkey
    const connection: Omit<NwcConnection, "id" | "createdAt" | "updatedAt" | "revoked"> = {
        userId: account.kratosUserId,
        accountId: account.id,
        alias: checkedAlias,
        walletId: checkedWalletId,
        apiKey,
        appPubkey,
        permissions: checkedPermissions,
        budget: checkedBudget,
    }
    const connectionObj = await ConnectionsRepository().create(connection)
    if (connectionObj instanceof Error) {
        return connectionObj
    }

    const serverPubkey = getServerKeypair().pubkey
    //create connection uri - it shouldn't be stored in wallet service - user should store it safely
    const connectionUri = stringifyNwcUri({
        pubkey: serverPubkey,
        secret,
        relay: NOSTR_RELAY_URL,
    })

    return {
        connectionObj,
        connectionUri,
    }
}

export const updateNwcConnection = async (
    account: Account,
    connectionId: NwcConnectionId,
    updates: {
        alias?: NwcConnectionAlias
        permissions?: Nip47Method[]
        budget?: NwcBudget | null // if budget isn't specified in request - don't update it. if it's null - budget settings should be removed -> infinite budget
    },
): Promise<NwcConnection | ApplicationError> => {
    const checkedConnectionId = checkedToConnectionId(connectionId)
    if (checkedConnectionId instanceof Error) {
        return checkedConnectionId
    }

    const checkedUpdates = checkedToNwcUpdates(updates)
    if (checkedUpdates instanceof Error) {
        return checkedUpdates
    }

    const existingConnection = await ConnectionsRepository().findById(connectionId)
    if (existingConnection instanceof Error) {
        return existingConnection
    }

    if(existingConnection.accountId != account.id) {
        // todo maybe invalid account exception?
    }

    return await ConnectionsRepository().update(connectionId, checkedUpdates)
}

export const softDeleteNwcConnection = async (
    account: Account,
    connectionId: NwcConnectionId,
): Promise<boolean | ApplicationError> => {
    const checkedConnectionId = checkedToConnectionId(connectionId)
    if (checkedConnectionId instanceof Error) {
        return checkedConnectionId
    }

    const existingConnection = await ConnectionsRepository().findById(checkedConnectionId)
    if (existingConnection instanceof Error) {
        return existingConnection
    }
    if (existingConnection.accountId != account.id) {
        // todo maybe invalid account exception?
    }

    return await ConnectionsRepository().softDelete(existingConnection.id)
}

export const deleteNwcConnection = async (
    connectionId: NwcConnectionId,
): Promise<boolean | ApplicationError> => {
    const checkedConnectionId = checkedToConnectionId(connectionId)
    if (checkedConnectionId instanceof Error) {
        return checkedConnectionId
    }

    const existingConnection = await ConnectionsRepository().findById(checkedConnectionId)
    if (existingConnection instanceof Error) {
        return existingConnection
    }

    return await ConnectionsRepository().delete(existingConnection.id)
}

export const getNwcConnectionById = async (
    connectionId: NwcConnectionId,
): Promise<NwcConnection | ApplicationError> => {
    const checkedConnectionId = checkedToConnectionId(connectionId)
    if (checkedConnectionId instanceof Error) {
        return checkedConnectionId
    }
    return await ConnectionsRepository().findById(checkedConnectionId)
}

export const nwcConnectionsByUserId = async (
    userId: string
): Promise<NwcConnection[] | ApplicationError> => {
    const checkedUserId = checkedToUserId(userId)
    if (checkedUserId instanceof Error) {
        return checkedUserId
    }
    return await ConnectionsRepository().findByUserId(checkedUserId)
}

export const nwcConnectionsByWalletId = async (
    walletId: string,
): Promise<NwcConnection[] | ApplicationError> => {
    const checkedWalletId = checkedToWalletId(walletId)
    if (checkedWalletId instanceof Error) {
        return checkedWalletId
    }
    return await ConnectionsRepository().findByWalletId(checkedWalletId)
}
