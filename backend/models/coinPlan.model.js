const mongoose = require("mongoose");

const coinPlanSchema = new mongoose.Schema(
  {
    coins: { type: Number, default: 0 },
    bonusCoins: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    iconUrl: { type: String, default: "" },
    productId: { type: String, default: "" },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

coinPlanSchema.index({ coins: 1 });
coinPlanSchema.index({ price: 1 });

module.exports = mongoose.model("CoinPlan", coinPlanSchema);
