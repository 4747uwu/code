const mongoose = require("mongoose");

const liveBroadcastViewSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    gender: { type: String, default: "" },
    image: { type: String, default: "" },
    countryFlagImage: { type: String, default: "" },
    country: { type: String, trim: true, lowercase: true, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    liveHistoryId: { type: mongoose.Schema.Types.ObjectId, ref: "LiveBroadcastHistory", default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

liveBroadcastViewSchema.index({ userId: 1 });
liveBroadcastViewSchema.index({ liveHistoryId: 1 });

module.exports = mongoose.model("LiveBroadcastView", liveBroadcastViewSchema);
