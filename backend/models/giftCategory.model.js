const mongoose = require("mongoose");

const giftCategorySchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    isDelete: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

giftCategorySchema.index({ createdAt: -1 });

module.exports = mongoose.model("GiftCategory", giftCategorySchema);
