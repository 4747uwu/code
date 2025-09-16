const mongoose = require("mongoose");

const liveBroadcastHistorySchema = new mongoose.Schema(
  {
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null },
    coins: { type: Number, default: 0 },
    gifts: { type: Number, default: 0 },
    audienceCount: { type: Number, default: 0 },
    liveComments: { type: Number, default: 0 },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    duration: { type: String, default: "00:00:00" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

liveBroadcastHistorySchema.index({ hostId: 1 });
liveBroadcastHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model("LiveBroadcastHistory", liveBroadcastHistorySchema);
