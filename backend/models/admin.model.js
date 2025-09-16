const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    uid: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    password: { type: String, trim: true, default: "" },
    image: { type: String, trim: true, default: "" },
    purchaseCode: { type: String, trim: true, default: "" },
    flag: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Admin", adminSchema);
