import client from "@/graphql/internal-client"
import { ApiKey, InvoiceBolt11, Memo } from "@/domain/index.types"
import {
  CouldNotCreateInvoiceError,
  CouldNotFetchNodeInfoError, CouldNotGetBalanceError,
  CouldNotPayInvoiceError,
  UnknownRepositoryError,
} from "@/domain/errors"
import { createInvoice } from "@/graphql/internal-client/mutations/create-invoice"
import { DescriptionHash, Satoshis, WalletId } from "@/domain/core/index.types"
import { Minutes } from "@/domain/units"
import { payInvoice } from "@/graphql/internal-client/mutations/pay-invoice"
import { payInvoiceAmountless } from "@/graphql/internal-client/mutations/pay-invoice-amountless"
import { IError } from "@/graphql/index.types"
import {getBalance} from "@/graphql/internal-client/queries/get-balance";

export const BlinkCoreService = () => ({
  async getNodeInfo() {
    try {
      // todo - there will be a query returning these data from blinks lnd node
    } catch (_) {
      return new CouldNotFetchNodeInfoError()
    }
    return {
      block_height: 0,
      block_hash: "unknown",
    }
  },

  async getBalance(apiKey: ApiKey, walletId: WalletId){
    try{
      const res = await getBalance(client, apiKey, walletId)
    } catch(_){
      return new CouldNotGetBalanceError()
    }
  },

  async createInvoice(
    apiKey: ApiKey,
    walletId: WalletId,
    amount: Satoshis,
    descriptionHash: DescriptionHash,
    expiry?: Minutes,
  ) {
    try {
      const res = await createInvoice(
        client,
        apiKey,
        walletId,
        amount,
        descriptionHash,
        expiry,
      )
      if (!res) {
        //todo react properly
        return new CouldNotCreateInvoiceError()
      }
      if (res.lnInvoiceCreateOnBehalfOfRecipient.errors.length > 0) {
        return new CouldNotCreateInvoiceError()
      }
      return res.lnInvoiceCreateOnBehalfOfRecipient.invoice
    } catch (_) {
      return new CouldNotCreateInvoiceError()
    }
  },

  async payInvoice(
    apiKey: ApiKey,
    walletId: WalletId,
    invoice: InvoiceBolt11,
    memo?: Memo,
  ) {
    try {
      const res = await payInvoice(client, apiKey, invoice, walletId, memo)
      if (!res) {
        //todo react properly
        throw null
      }
      if (res.lnInvoicePaymentSend.errors.length > 0) {
        //todo map and parse if necessary
      }
      return res.lnInvoicePaymentSend.transaction
    } catch (_) {
      return new CouldNotPayInvoiceError()
    }
  },

  async payInvoiceAmountless(
    apiKey: ApiKey,
    walletId: WalletId,
    invoice: InvoiceBolt11,
    amount: Satoshis,
  ) {
    try {
      const res = await payInvoiceAmountless(client, apiKey, walletId, invoice, amount)
      if (!res) {
        //todo react properly
        throw null
      }
      if (res.lnNoAmountInvoicePaymentSend.errors.length > 0) {
        //todo map and parse if necessary
      }
      return res.lnNoAmountInvoicePaymentSend.transaction
    } catch (_) {
      return new CouldNotPayInvoiceError()
    }
  },
})

const parseBlinkError = (err: IError) => {
  // handle by message first
  switch (err.message) {
    default:
      return new UnknownRepositoryError()
  }
  switch (err.code) {
    default:
      return new UnknownRepositoryError()
  }
}
export const KnownBlinkErrorDetails = {
  InvalidConnection: "ECONNREFUSED",
  InvalidCredentials: "28P01",
  InvalidDatabase: "3D000",
} as const
export const KnownBlinkErrorCodes = {}
