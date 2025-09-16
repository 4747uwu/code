const mongoose = require("mongoose");

const BlockSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", required: true },
    blockedBy: { type: String, enum: ["user", "host"], required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Block", BlockSchema);
