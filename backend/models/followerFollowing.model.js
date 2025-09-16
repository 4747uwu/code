const mongoose = require("mongoose");

const followerFollowingSchema = new mongoose.Schema(
  {
    followerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, //A person who followed me
    followingId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null }, //A person to whom followed
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

followerFollowingSchema.index({ followerId: 1 });
followerFollowingSchema.index({ followingId: 1 });
followerFollowingSchema.index({ createdAt: -1 });

module.exports = mongoose.model("FollowerFollowing", followerFollowingSchema);
