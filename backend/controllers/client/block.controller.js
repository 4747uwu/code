const Block = require("../../models/block.model");

//import model
const User = require("../../models/user.model");
const Host = require("../../models/host.model");
const FollowerFollowing = require("../../models/followerFollowing.model");

//mongoose
const mongoose = require("mongoose");

//handle user blocking a host
exports.blockHost = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid request. hostId is required." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const [user, host, existingBlock] = await Promise.all([
      User.findById(userId).select("_id").lean(),
      Host.findById(hostId).select("_id").lean(),
      Block.findOne({ userId, hostId, blockedBy: "user" }).select("_id").lean(),
    ]);

    if (!user) return res.status(200).json({ status: false, message: "User not found." });
    if (!host) return res.status(200).json({ status: false, message: "Host not found." });

    if (existingBlock) {
      res.status(200).json({ status: true, message: "Host unblocked successfully.", isBlocked: false });

      await Block.deleteOne({ userId, hostId });
    } else {
      res.status(200).json({ status: true, message: "Host blocked successfully.", isBlocked: true });

      await Promise.all([
        new Block({ userId, hostId, blockedBy: "user" }).save(),
        FollowerFollowing.deleteOne({ followerId: userId, followingId: hostId }), // Unfollow if blocked
      ]);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//handle host blocking a user
exports.blockUser = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid request. hostId is required." });
    }

    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "Invalid request. userId is required." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);
    const userId = new mongoose.Types.ObjectId(req.query.userId);

    const [host, user, existingBlock] = await Promise.all([
      Host.findById(hostId).select("_id").lean(),
      User.findById(userId).select("_id").lean(),
      Block.findOne({ userId, hostId, blockedBy: "host" }).select("_id").lean(),
    ]);

    if (!host) return res.status(200).json({ status: false, message: "Host not found." });
    if (!user) return res.status(200).json({ status: false, message: "User not found." });

    if (existingBlock) {
      res.status(200).json({ status: true, message: "User unblocked successfully.", isBlocked: false });

      await Block.deleteOne({ userId, hostId });
    } else {
      res.status(200).json({ status: true, message: "User blocked successfully.", isBlocked: true });

      await Promise.all([
        new Block({ userId, hostId, blockedBy: "host" }).save(),
        FollowerFollowing.deleteOne({ followerId: userId, followingId: hostId }), // Unfollow if blocked
      ]);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//get blocked hosts for a user
exports.getBlockedHostsForUser = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const blockedHosts = await Block.find({ blockedBy: "user", userId })
      .select("hostId")
      .populate("hostId", "name image countryFlagImage country")
      .skip((start - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      status: true,
      message: blockedHosts.length > 0 ? "Blocked hosts retrieved successfully." : "No blocked hosts found.",
      blockedHosts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//get blocked users for a host
exports.getBlockedUsersForHost = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid request. hostId is required." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const blockedUsers = await Block.find({ blockedBy: "host", hostId })
      .select("userId")
      .populate("userId", "name image countryFlagImage country")
      .skip((start - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      status: true,
      message: blockedUsers.length > 0 ? "Blocked users retrieved successfully." : "No blocked users found.",
      blockedUsers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};
