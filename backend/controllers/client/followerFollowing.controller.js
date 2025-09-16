const FollowerFollowing = require("../../models/followerFollowing.model");

//import model
const User = require("../../models/user.model");
const Host = require("../../models/host.model");
const Block = require("../../models/block.model");

//mongoose
const mongoose = require("mongoose");

//private key
const admin = require("../../util/privateKey");

//follow or unfollow
exports.handleFollowUnfollow = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.query.followingId) {
      return res.status(200).json({ status: false, message: "Invalid request. followingId is required." });
    }

    const followerId = new mongoose.Types.ObjectId(req.user.userId);
    const followingId = new mongoose.Types.ObjectId(req.query.followingId);

    const [fromUser, toUser, existingFollow, isBlocked] = await Promise.all([
      User.findById(followerId).select("_id image").lean(),
      Host.findById(followingId).select("_id isBlock fcmToken").lean(),
      FollowerFollowing.findOne({ followerId, followingId }).select("_id").lean(),
      Block.findOne({ userId: followerId, hostId: followingId }).select("_id").lean(), // Check if user has blocked the host
    ]);

    console.log("existingFollow =====================", existingFollow);

    if (!fromUser) return res.status(200).json({ status: false, message: "User not found." });
    if (!toUser) return res.status(200).json({ status: false, message: "Host not found." });
    if (toUser.isBlock) return res.status(403).json({ status: false, message: "Host is blocked." });

    if (fromUser._id.equals(toUser._id)) {
      return res.status(200).json({ status: false, message: "You can't follow your own account." });
    }

    if (isBlocked) {
      return res.status(403).json({ status: false, message: "You have blocked this host. Unblock to follow." });
    }

    if (existingFollow) {
      await FollowerFollowing.deleteOne({ followerId, followingId });
      return res.status(200).json({ status: true, message: "Unfollowed successfully.", isFollow: false });
    } else {
      await new FollowerFollowing({ followerId, followingId }).save();
      res.status(200).json({ status: true, message: "Followed successfully.", isFollow: true });

      if (toUser.fcmToken) {
        const payload = {
          token: toUser.fcmToken,
          notification: {
            title: "🌟 New Follower Alert! 👤✨",
            body: "🚀 You’ve got a new fan! Someone just followed you—check them out now! 👀💫",
          },
          data: { type: "FOLLOW" },
        };

        const adminPromise = await admin;

        adminPromise
          .messaging()
          .send(payload)
          .then((response) => console.log("Notification sent:", response))
          .catch((error) => console.log("Error sending notification:", error));
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//get list of following
exports.getFollowingList = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const [user, followingList] = await Promise.all([
      User.findById(userId).select("_id").lean(),
      FollowerFollowing.find({ followerId: userId }).populate("followingId", "_id name image").sort({ createdAt: -1 }).lean(),
    ]);

    if (!user) return res.status(200).json({ status: false, message: "User not found." });
    if (user.isBlock) return res.status(403).json({ status: false, message: "User is blocked." });

    res.status(200).json({
      status: true,
      message: `Retrieved following users successfully.`,
      followingList,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//get list of followers
exports.getFollowerList = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "hostId is required." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const [host, followerList] = await Promise.all([
      Host.findById(hostId).select("_id isBlock").lean(),
      FollowerFollowing.find({ followingId: hostId }).populate("followerId", "_id name image").sort({ createdAt: -1 }).lean(),
    ]);

    if (!host) return res.status(200).json({ status: false, message: "Host not found." });
    if (host.isBlock) return res.status(403).json({ status: false, message: "Host is blocked." });

    res.status(200).json({
      status: true,
      message: `Retrieved followers successfully.`,
      followerList,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};
