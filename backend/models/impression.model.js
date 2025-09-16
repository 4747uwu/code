const mongoose = require("mongoose");

const impressionSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Impression", impressionSchema);
