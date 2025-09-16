const mongoose = require("mongoose");

const { WITHDRAWAL_STATUS, WITHDRAWAL_PERSON } = require("../types/constant");

const withdrawalRequestSchema = new mongoose.Schema(
  {
    person: { type: Number, enum: WITHDRAWAL_PERSON }, // 1. agency, 2. host
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency", default: null },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null },
    uniqueId: { type: String, default: "" },
    status: { type: Number, default: 1, enum: WITHDRAWAL_STATUS },
    coin: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    paymentGateway: { type: String, default: "" },
    paymentDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    reason: { type: String, default: "" },
    requestDate: { type: String, default: "" },
    acceptOrDeclineDate: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

withdrawalRequestSchema.index({ person: 1 });
withdrawalRequestSchema.index({ status: 1 });
withdrawalRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.models.WithdrawalRequest || mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
