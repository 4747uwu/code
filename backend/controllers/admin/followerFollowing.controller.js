const FollowerFollowing = require("../../models/followerFollowing.model");

//import model
const User = require("../../models/user.model");
const Host = require("../../models/host.model");

//mongoose
const mongoose = require("mongoose");

//get list of following
exports.fetchFollowing = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "userId must be requried." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const userId = new mongoose.Types.ObjectId(req.query.userId);

    const [user, total, followingList] = await Promise.all([
      User.findById(userId).select("_id").lean(),
      FollowerFollowing.countDocuments({ followerId: userId }),
      FollowerFollowing.find({ followerId: userId })
        .populate("followingId", "_id name image uniqueId coin countryFlagImage country")
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    if (!user) return res.status(200).json({ status: false, message: "User not found." });

    return res.status(200).json({
      status: true,
      message: `Retrieved following users successfully.`,
      total,
      followingList,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//get list of followers
exports.fetchFollowers = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "hostId is required." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const [host, total, followerList] = await Promise.all([
      Host.findById(hostId).select("_id isBlock").lean(),
      FollowerFollowing.countDocuments({ followingId: hostId }),
      FollowerFollowing.find({ followingId: hostId })
        .populate("followerId", "_id name image uniqueId coin countryFlagImage country")
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    if (!host) return res.status(200).json({ status: false, message: "Host not found." });

    res.status(200).json({
      status: true,
      message: `Retrieved followers successfully.`,
      total,
      followerList,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};
