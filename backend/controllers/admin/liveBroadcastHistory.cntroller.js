const LiveBroadcastHistory = require("../../models/liveBroadcastHistory.model");

//mongoose
const mongoose = require("mongoose");

//import model
const Host = require("../../models/host.model");

//get live history ( host )
exports.fetchLiveHistory = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid request parameters." });
    }

    if (req.query.hostId && !mongoose.Types.ObjectId.isValid(req.query.hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId. Please provide a valid ObjectId." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: startDateObj,
          $lte: endDateObj,
        },
      };
    }

    const [host, total, liveHistoryData] = await Promise.all([
      Host.findOne({ _id: hostId }).lean().select("_id"),
      LiveBroadcastHistory.countDocuments({ hostId, ...dateFilterQuery }),
      LiveBroadcastHistory.find({ hostId, ...dateFilterQuery })
        .select("coins gifts audienceCount liveComments startTime endTime duration createdAt")
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    return res.status(200).json({
      status: true,
      message: "User live history retrieved successfully.",
      total,
      data: liveHistoryData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};
