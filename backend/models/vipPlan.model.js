const mongoose = require("mongoose");

const vipPlanSchema = new mongoose.Schema(
  {
    validity: { type: Number, default: 0 },
    validityType: { type: String, trim: true, lowercase: true, default: "" },
    coin: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

vipPlanSchema.index({ coin: 1, price: 1 });
vipPlanSchema.index({ isActive: 1 });

module.exports = mongoose.model("VipPlan", vipPlanSchema);
