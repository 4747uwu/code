const LiveBroadcaster = require("../../models/liveBroadcaster.model");
const Agency = require("../../models/agency.model");

const mongoose = require("mongoose");

//get live hosts
exports.getLiveHosts = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const agencyObjectId = new mongoose.Types.ObjectId(req.agency._id);

    const [agency, liveHosts, totalCount] = await Promise.all([
      Agency.findById(agencyObjectId).select("_id").lean(),
      LiveBroadcaster.aggregate([
        {
          $match: {
            hostId: { $ne: null },
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "hostId",
            foreignField: "_id",
            as: "hostData",
          },
        },
        { $unwind: "$hostData" },
        {
          $match: {
            "hostData.agencyId": agencyObjectId,
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            gender: 1,
            image: 1,
            countryFlagImage: 1,
            country: 1,
            view: 1,
            createdAt: 1,
          },
        },
        { $sort: { view: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
      LiveBroadcaster.aggregate([
        {
          $match: {
            hostId: { $ne: null },
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "hostId",
            foreignField: "_id",
            as: "hostData",
          },
        },
        { $unwind: "$hostData" },
        {
          $match: {
            "hostData.agencyId": agencyObjectId,
          },
        },
        {
          $count: "total",
        },
      ]),
    ]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    const count = totalCount.length > 0 ? totalCount[0].total : 0;

    return res.status(200).json({
      status: true,
      message: "Live hosts retrieved successfully.",
      total: count,
      hosts: liveHosts,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "An error occurred while retrieving live hosts.",
      error: error.message || "Internal Server Error",
    });
  }
};
