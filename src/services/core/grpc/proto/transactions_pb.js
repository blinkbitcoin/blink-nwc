'use strict';
/* eslint-disable */

var jspb = require('google-protobuf');

var TransactionType = {
  TRANSACTION_TYPE_UNSPECIFIED: 0,
  SENT: 1,
  RECEIVED: 2,
};

var SettlementViaType = {
  SETTLEMENT_VIA_UNSPECIFIED: 0,
  LIGHTNING: 1,
  INTRA_LEDGER: 2,
  ONCHAIN: 3,
};

class SubscribeTransactionsRequest {
  constructor(data) {
    this.afterTransactionId = data && data.afterTransactionId !== undefined
      ? data.afterTransactionId
      : undefined;
  }

  getAfterTransactionId() {
    return this.afterTransactionId ?? '';
  }

  setAfterTransactionId(value) {
    this.afterTransactionId = value;
    return this;
  }

  clearAfterTransactionId() {
    this.afterTransactionId = undefined;
    return this;
  }

  hasAfterTransactionId() {
    return this.afterTransactionId !== undefined;
  }

  serializeBinary() {
    var writer = new jspb.BinaryWriter();
    SubscribeTransactionsRequest.serializeBinaryToWriter(this, writer);
    return writer.getResultBuffer();
  }

  toObject(includeInstance) {
    return SubscribeTransactionsRequest.toObject(includeInstance, this);
  }

  static toObject(includeInstance, msg) {
    var obj = {
      afterTransactionId: msg.hasAfterTransactionId() ? msg.getAfterTransactionId() : undefined,
    };

    if (includeInstance) {
      obj.$jspbMessageInstance = msg;
    }

    return obj;
  }

  static serializeBinaryToWriter(message, writer) {
    if (message.hasAfterTransactionId()) {
      writer.writeString(1, message.getAfterTransactionId());
    }
  }

  static deserializeBinary(bytes) {
    var reader = new jspb.BinaryReader(bytes);
    var message = new SubscribeTransactionsRequest();
    return SubscribeTransactionsRequest.deserializeBinaryFromReader(message, reader);
  }

  static deserializeBinaryFromReader(message, reader) {
    while (reader.nextField()) {
      if (reader.isEndGroup()) break;

      switch (reader.getFieldNumber()) {
        case 1:
          message.setAfterTransactionId(reader.readString());
          break;
        default:
          reader.skipField();
      }
    }

    return message;
  }
}

class TransactionEvent {
  constructor(data) {
    var input = data || {};

    this.ledgerTransactionId = input.ledgerTransactionId ?? '';
    this.walletId = input.walletId ?? '';
    this.accountId = input.accountId ?? '';
    this.paymentHash = input.paymentHash ?? '';
    this.preimage = input.preimage ?? '';
    this.satsAmount = input.satsAmount ?? 0;
    this.centsAmount = input.centsAmount ?? 0;
    this.currency = input.currency ?? '';
    this.type = input.type ?? TransactionType.TRANSACTION_TYPE_UNSPECIFIED;
    this.settlementVia =
      input.settlementVia ?? SettlementViaType.SETTLEMENT_VIA_UNSPECIFIED;
    this.pending = input.pending ?? false;
    this.timestamp = input.timestamp ?? 0;
  }

  getLedgerTransactionId() {
    return this.ledgerTransactionId;
  }

  setLedgerTransactionId(value) {
    this.ledgerTransactionId = value;
    return this;
  }

  getWalletId() {
    return this.walletId;
  }

  setWalletId(value) {
    this.walletId = value;
    return this;
  }

  getAccountId() {
    return this.accountId;
  }

  setAccountId(value) {
    this.accountId = value;
    return this;
  }

  getPaymentHash() {
    return this.paymentHash;
  }

  setPaymentHash(value) {
    this.paymentHash = value;
    return this;
  }

  getPreimage() {
    return this.preimage;
  }

  setPreimage(value) {
    this.preimage = value;
    return this;
  }

  getSatsAmount() {
    return this.satsAmount;
  }

  setSatsAmount(value) {
    this.satsAmount = value;
    return this;
  }

  getCentsAmount() {
    return this.centsAmount;
  }

  setCentsAmount(value) {
    this.centsAmount = value;
    return this;
  }

  getCurrency() {
    return this.currency;
  }

  setCurrency(value) {
    this.currency = value;
    return this;
  }

  getType() {
    return this.type;
  }

  setType(value) {
    this.type = value;
    return this;
  }

  getSettlementVia() {
    return this.settlementVia;
  }

  setSettlementVia(value) {
    this.settlementVia = value;
    return this;
  }

  getPending() {
    return this.pending;
  }

  setPending(value) {
    this.pending = value;
    return this;
  }

  getTimestamp() {
    return this.timestamp;
  }

  setTimestamp(value) {
    this.timestamp = value;
    return this;
  }

  serializeBinary() {
    var writer = new jspb.BinaryWriter();
    TransactionEvent.serializeBinaryToWriter(this, writer);
    return writer.getResultBuffer();
  }

  toObject(includeInstance) {
    return TransactionEvent.toObject(includeInstance, this);
  }

  static toObject(includeInstance, msg) {
    var obj = {
      ledgerTransactionId: msg.getLedgerTransactionId(),
      walletId: msg.getWalletId(),
      accountId: msg.getAccountId(),
      paymentHash: msg.getPaymentHash(),
      preimage: msg.getPreimage(),
      satsAmount: msg.getSatsAmount(),
      centsAmount: msg.getCentsAmount(),
      currency: msg.getCurrency(),
      type: msg.getType(),
      settlementVia: msg.getSettlementVia(),
      pending: msg.getPending(),
      timestamp: msg.getTimestamp(),
    };

    if (includeInstance) {
      obj.$jspbMessageInstance = msg;
    }

    return obj;
  }

  static serializeBinaryToWriter(message, writer) {
    if (message.getLedgerTransactionId().length > 0) {
      writer.writeString(1, message.getLedgerTransactionId());
    }
    if (message.getWalletId().length > 0) {
      writer.writeString(2, message.getWalletId());
    }
    if (message.getAccountId().length > 0) {
      writer.writeString(3, message.getAccountId());
    }
    if (message.getPaymentHash().length > 0) {
      writer.writeString(4, message.getPaymentHash());
    }
    if (message.getPreimage().length > 0) {
      writer.writeString(5, message.getPreimage());
    }
    if (message.getSatsAmount() !== 0) {
      writer.writeInt64(6, message.getSatsAmount());
    }
    if (message.getCentsAmount() !== 0) {
      writer.writeInt64(7, message.getCentsAmount());
    }
    if (message.getCurrency().length > 0) {
      writer.writeString(8, message.getCurrency());
    }
    if (message.getType() !== TransactionType.TRANSACTION_TYPE_UNSPECIFIED) {
      writer.writeEnum(9, message.getType());
    }
    if (message.getSettlementVia() !== SettlementViaType.SETTLEMENT_VIA_UNSPECIFIED) {
      writer.writeEnum(10, message.getSettlementVia());
    }
    if (message.getPending()) {
      writer.writeBool(11, message.getPending());
    }
    if (message.getTimestamp() !== 0) {
      writer.writeUint64(12, message.getTimestamp());
    }
  }

  static deserializeBinary(bytes) {
    var reader = new jspb.BinaryReader(bytes);
    var message = new TransactionEvent();
    return TransactionEvent.deserializeBinaryFromReader(message, reader);
  }

  static deserializeBinaryFromReader(message, reader) {
    while (reader.nextField()) {
      if (reader.isEndGroup()) break;

      switch (reader.getFieldNumber()) {
        case 1:
          message.setLedgerTransactionId(reader.readString());
          break;
        case 2:
          message.setWalletId(reader.readString());
          break;
        case 3:
          message.setAccountId(reader.readString());
          break;
        case 4:
          message.setPaymentHash(reader.readString());
          break;
        case 5:
          message.setPreimage(reader.readString());
          break;
        case 6:
          message.setSatsAmount(reader.readInt64());
          break;
        case 7:
          message.setCentsAmount(reader.readInt64());
          break;
        case 8:
          message.setCurrency(reader.readString());
          break;
        case 9:
          message.setType(reader.readEnum());
          break;
        case 10:
          message.setSettlementVia(reader.readEnum());
          break;
        case 11:
          message.setPending(reader.readBool());
          break;
        case 12:
          message.setTimestamp(reader.readUint64());
          break;
        default:
          reader.skipField();
      }
    }

    return message;
  }
}

module.exports = {
  SettlementViaType: SettlementViaType,
  SubscribeTransactionsRequest: SubscribeTransactionsRequest,
  TransactionEvent: TransactionEvent,
  TransactionType: TransactionType,
};
