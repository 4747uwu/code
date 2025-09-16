const mongoose = require("mongoose");

const agencySchema = new mongoose.Schema(
  {
    uid: { type: String, default: "" },
    agencyCode: { type: String, unique: true, default: "" },
    name: { type: String, default: "" },
    commissionType: { type: Number, enum: [1, 2] }, //1.percentage 2.salary
    commission: { type: Number, default: 0 },
    email: { type: String, default: "" },
    password: { type: String, default: "" },
    countryCode: { type: Number, default: 0 },
    mobileNumber: { type: Number, default: 0 },
    image: { type: String, default: "" },
    description: { type: String, default: "" },
    countryFlagImage: { type: String, default: "" },
    country: { type: String, default: "" },
    isBlock: { type: Boolean, default: false },
    hostCoins: { type: Number, default: 0, min: 0 },
    totalEarnings: { type: Number, default: 0, min: 0 },
    netAvailableEarnings: { type: Number, default: 0, min: 0 }, //Net currently earning after withdrawals
    totalWithdrawn: { type: Number, default: 0, min: 0 },
    totalWithdrawnAmount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

agencySchema.index({ isBlock: 1 });
agencySchema.index({ netAvailableEarnings: 1 });
agencySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Agency", agencySchema);
