const Block = require("../../models/block.model");

const mongoose = require("mongoose");

//get blocked hosts for a user
exports.listBlockedHostsForUser = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "userId must be requried." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const userId = new mongoose.Types.ObjectId(req.query.userId);

    const blockedHosts = await Block.find({ blockedBy: "user", userId })
      .select("hostId")
      .populate("hostId", "name image uniqueId coin countryFlagImage country")
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
exports.listBlockedUsersForHost = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid request. hostId is required." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const blockedUsers = await Block.find({ blockedBy: "host", hostId })
      .select("userId")
      .populate("userId", "name image uniqueId coin countryFlagImage country")
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
