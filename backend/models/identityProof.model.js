const mongoose = require("mongoose");

const identityProofSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("IdentityProof", identityProofSchema);
