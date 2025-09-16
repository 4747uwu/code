const { HISTORY_TYPE, WITHDRAWAL_STATUS } = require("../types/constant");

const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
  {
    uniqueId: { type: String, unique: true, trim: true, default: "" },
    type: { type: Number, enum: HISTORY_TYPE },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Sender OR Caller
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency", default: null }, // Agency under which host
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null }, // Receiver

    giftId: { type: mongoose.Schema.Types.ObjectId, ref: "Gift", default: null },
    giftCount: { type: Number, default: 0 },
    giftCoin: { type: Number, default: 0 },
    giftType: { type: Number, default: 0 },
    giftImage: { type: String, default: "" },
    
    callType: { type: String, default: "" }, //1.audio 2.video
    isRandom: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    callConnect: { type: Boolean, default: false },
    callStartTime: { type: String, default: "" },
    callEndTime: { type: String, default: "" },
    duration: { type: String, default: "00:00:00" },

    userCoin: { type: Number, default: 0 },
    hostCoin: { type: Number, default: 0 },
    adminCoin: { type: Number, default: 0 },
    agencyCoin: { type: Number, default: 0 }, //agency earn commission on host's earning

    bonusCoins: { type: Number, default: 0 },
    validity: { type: Number, default: 0 },
    validityType: { type: String, default: "" },
    price: { type: Number, default: 0 },

    payoutStatus: { type: Number, default: 0, enum: WITHDRAWAL_STATUS },
    reason: { type: String, default: "" },

    paymentGateway: { type: String, default: "" },

    date: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

historySchema.index({ type: 1 });
historySchema.index({ agencyId: 1 });
historySchema.index({ hostId: 1 });
historySchema.index({ userId: 1 });
historySchema.index({ giftId: 1 });
historySchema.index({ createdAt: -1 });

module.exports = mongoose.model("History", historySchema);
