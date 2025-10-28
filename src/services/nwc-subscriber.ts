import { finalizeEvent, EventTemplate, Relay } from "nostr-tools"
import { Subscription } from "nostr-tools/lib/types/abstract-relay"

import {NOSTR_RELAY_URL, SUPPORTED_NWC_METHODS} from "@/config"
import {sleep} from "@/utils";
import {getServerKeypair, NwcConnection} from "@/domain/nwc-connection";
import {Nip47EncryptionType, Nip47Method, Nip47Response, Nip47Result, NwcAppPubkey} from "@/domain/index.types";
import {decrypt, encrypt, hexToBytes} from "@/domain/encryption";
import {parseNip47Response} from "@/domain";
import {Nip47UnauthorizedError} from "@/domain/nwc-errors";
import {ConnectionsRepository} from "@/services/db";

const NwcSubscriber = () => {
    const r = new Relay(NOSTR_RELAY_URL)
    const serverKeypair = getServerKeypair()

    const subscribe = (
        handle: (
            request: {
                method: Nip47Method
                params: unknown
            },
            connection: NwcConnection,
        ) => Promise<Nip47Result>,
    ) => {
        let isRunning = true
        let endPromise: (() => void) | undefined
        let onRelayDisconnect: (() => void) | undefined
        let sub: Subscription | undefined

        let retries = 0

        const run = async () => {
            while (isRunning) {
                try {
                    if (sub) {
                        sub.close()
                    }
                    console.info("checking connection to relay")
                    await checkConnected()

                    console.info("publishing info event")
                    await publishInfoEvent()

                    console.info("subscribing to relay")
                    sub = r.subscribe(
                        [
                            {
                                "kinds": [23194],
                                "#p": [serverKeypair.pubkey],
                            },
                        ],
                        {},
                    )
                    console.info("subscribed to relay")
                    retries = 0

                    sub.onevent = async (event) => {
                        try {
                            const encryptionType = (event.tags.find(
                                (t) => t[0] === "encryption",
                            )?.[1] || "nip04") as Nip47EncryptionType

                            const decryptedContent = await decrypt(
                                serverKeypair,
                                event.pubkey as NwcAppPubkey,
                                event.content,
                                encryptionType,
                            )
                            const request = JSON.parse(decryptedContent) as {
                                method: Nip47Method
                                params: unknown
                            }

                            const userConnection = await ConnectionsRepository().findByPubkey(event.pubkey)
                            if (userConnection instanceof Error) {
                                await sendNwcResponse(
                                    event.id,
                                    event.pubkey as NwcAppPubkey,
                                    request.method,
                                    encryptionType,
                                    parseNip47Response(
                                        new Nip47UnauthorizedError(
                                            "No connection found with provided pubkey ",
                                        ),
                                    ),
                                )
                                return
                            }

                            const response = await handle(request, userConnection)
                            await sendNwcResponse(
                                event.id,
                                event.pubkey as NwcAppPubkey,
                                request.method,
                                encryptionType,
                                parseNip47Response(response),
                            )
                        } catch (e) {
                            console.error("Failed to parse decrypted event content", e)
                            return
                        }
                    }

                    await new Promise<void>((resolve) => {
                        endPromise = () => {
                            resolve()
                        }
                        onRelayDisconnect = () => {
                            console.error("relay disconnected")
                            endPromise?.()
                        }
                        r.onclose = onRelayDisconnect
                    })
                    if (onRelayDisconnect !== undefined) {
                        r.onclose = null
                    }
                } catch (error) {
                    console.error("error subscribing to requests", error || "unknown relay error")
                }
                if (isRunning) {
                    await backoff(retries++)
                }
            }
        }

        const stop = async () => {
            isRunning = false
            if (sub) {
                sub.close()
            }
            r.close()
        }
    }

    const checkConnected = async () => {
        try {
            if (!r.connected) {
                await r.connect()
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            console.error("failed to connect to relay", NOSTR_RELAY_URL)
        }
    }

    const publishInfoEvent = async () => {
        const infoEventTemplate: EventTemplate = {
            kind: 13194,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["encryption", "nip44_v2 nip04"],
                //todo add notifications when implemented
                // ["notifications"]
            ],
            content: SUPPORTED_NWC_METHODS.join(" "),
        }

        const infoEvent = finalizeEvent(
            infoEventTemplate,
            hexToBytes(serverKeypair.privkey),
        )

        await r.publish(infoEvent)
        console.info("Published info event to relay")
    }

    const sendNwcResponse = async (
        eventId: string,
        appPk: NwcAppPubkey,
        resultType: Nip47Method,
        encryptionType: Nip47EncryptionType,
        response: Nip47Response,
    ) => {
        const responseEventTemplate: EventTemplate = {
            kind: 23195,
            created_at: Math.floor(Date.now() / 1000),
            tags: [["e", eventId]],
            content: encrypt(
                serverKeypair,
                appPk,
                JSON.stringify({
                    result_type: resultType,
                    ...response,
                }),
                encryptionType,
            ),
        }

        const responseEvent = finalizeEvent(
            responseEventTemplate,
            hexToBytes(serverKeypair.privkey),
        )
        await r.publish(responseEvent)
    }

    const backoff = async (retries: number) => {
        const SECOND = 1000
        const MAX_BACKOFF_MS = SECOND * 60 * 5
        const delay = Math.min(SECOND * Math.pow(2, retries), MAX_BACKOFF_MS)

        const jitter = Math.random() * delay * 0.1
        await sleep(Math.round(delay + jitter))
    }

    return { subscribe, stop }
}
export default NwcSubscriber
