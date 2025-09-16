const mongoose = require("mongoose");

const paymentMethodSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    image: { type: String, default: "" },
    details: { type: Array, default: [] },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

paymentMethodSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PaymentMethod", paymentMethodSchema);
