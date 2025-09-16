const mongoose = require("mongoose");

const liveBroadcasterSchema = new mongoose.Schema(
  {
    liveHistoryId: { type: mongoose.Schema.Types.ObjectId, ref: "LiveBroadcastHistory", default: null },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, //_id of user who become host

    name: { type: String, default: "" },
    gender: { type: String, default: "" },
    image: { type: String, default: "" },
    countryFlagImage: { type: String, default: "" },
    country: { type: String, trim: true, lowercase: true, default: "" },
    isFake: { type: Boolean, default: false },

    agoraUid: { type: Number, default: 0 },
    channel: { type: String, default: "" },
    token: { type: String, default: "" },
    view: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

liveBroadcasterSchema.index({ hostId: 1 });
liveBroadcasterSchema.index({ liveHistoryId: 1 });
liveBroadcasterSchema.index({ createdAt: -1 });

module.exports = mongoose.model("LiveBroadcaster", liveBroadcasterSchema);
