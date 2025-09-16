const mongoose = require("mongoose");

const HostMatchHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastHostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("HostMatchHistory", HostMatchHistorySchema);
