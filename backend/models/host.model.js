const { HOST_REQUEST_STATUS } = require("../types/constant");

const mongoose = require("mongoose");

const hostSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency", default: null },

    name: { type: String, default: "" },
    gender: { type: String, default: "" },
    bio: { type: String, default: "" },
    age: { type: Number, default: 18 },
    dob: { type: String, default: "" },
    email: { type: String, default: "" },
    countryFlagImage: { type: String, default: "" },
    country: { type: String, trim: true, lowercase: true, default: "" },

    impression: { type: Array, default: [] },
    language: { type: Array, default: [] },
    identityProofType: { type: String, default: "" },
    identityProof: { type: Array, default: [] },
    image: { type: String, default: "" },
    photoGallery: { type: Array, default: [] },
    video: { type: String, default: "" },

    ipAddress: { type: String, default: "" },
    identity: { type: String, default: "" },
    fcmToken: { type: String, default: null },
    uniqueId: { type: String, unique: true, default: "" },

    status: { type: Number, enum: HOST_REQUEST_STATUS, default: 1 },
    reason: { type: String, default: "" },

    randomCallRate: { type: Number, default: 0 },
    randomCallFemaleRate: { type: Number, default: 0 },
    randomCallMaleRate: { type: Number, default: 0 },
    privateCallRate: { type: Number, default: 0 },
    audioCallRate: { type: Number, default: 0 },
    chatRate: { type: Number, default: 0 },

    coin: { type: Number, default: 0 },
    totalGifts: { type: Number, default: 0 },

    redeemedCoins: { type: Number, default: 0 },
    redeemedAmount: { type: Number, default: 0 },

    isBlock: { type: Boolean, default: false },
    isFake: { type: Boolean, default: false },

    isOnline: { type: Boolean, default: false },
    isBusy: { type: Boolean, default: false },

    callId: { type: String, default: null },

    isLive: { type: Boolean, default: false },
    liveHistoryId: { type: mongoose.Schema.Types.ObjectId, ref: "LiveBroadcastHistory", default: null },
    agoraUid: { type: Number, default: 0 },
    channel: { type: String, default: "" },
    token: { type: String, default: "" },

    date: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

hostSchema.index({ isOnline: 1, isBusy: 1, isFake: 1, isLive: 1, isBlock: 1, callId: 1 });
hostSchema.index({ isFake: 1 });
hostSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Host", hostSchema);
