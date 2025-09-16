const Host = require("../../models/host.model");
const LiveBroadcaster = require("../../models/liveBroadcaster.model");
const WithdrawRequest = require("../../models/withdrawalRequest.model");
const History = require("../../models/history.model");
const Agency = require("../../models/agency.model");

//mongoose
const mongoose = require("mongoose");

//get dashboard count
exports.retrieveDashboardStats = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const agencyObjectId = new mongoose.Types.ObjectId(req.agency._id);

    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const formatStartDate = new Date(startDate);
      const formatEndDate = new Date(endDate);
      formatEndDate.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: formatStartDate,
          $lte: formatEndDate,
        },
      };
    }

    const [agency, pendingHostApplications, totalHosts, activeHosts, suspendedHosts, hostsLiveNow, totalPayoutPending, totalPayoutCompleted, agencyEarnings, agencyHostEarnings] = await Promise.all([
      Agency.findById(agencyObjectId).select("_id").lean(),
      Host.countDocuments({ ...dateFilterQuery, agencyId: agencyObjectId, status: 1 }),
      Host.countDocuments({ ...dateFilterQuery, agencyId: agencyObjectId, status: 2, isFake: false }),
      Host.countDocuments({ ...dateFilterQuery, agencyId: agencyObjectId, status: 2, isBlock: false, isFake: false }),
      Host.countDocuments({ ...dateFilterQuery, agencyId: agencyObjectId, status: 2, isBlock: true, isFake: false }),
      LiveBroadcaster.aggregate([
        {
          $match: {
            ...dateFilterQuery,
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
        { $count: "total" },
      ]),
      WithdrawRequest.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            person: 2,
            hostId: { $ne: null },
            status: 1,
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "hostId",
            foreignField: "_id",
            as: "host",
          },
        },
        { $unwind: "$host" },
        {
          $match: {
            "host.agencyId": agencyObjectId,
          },
        },
        { $count: "total" },
      ]),
      WithdrawRequest.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            person: 2,
            hostId: { $ne: null },
            status: 2,
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "hostId",
            foreignField: "_id",
            as: "host",
          },
        },
        { $unwind: "$host" },
        {
          $match: {
            "host.agencyId": agencyObjectId,
          },
        },
        { $count: "total" },
      ]),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            agencyId: agencyObjectId,
            type: { $in: [2, 3, 9, 10, 11, 12, 13] },
          },
        },
        {
          $group: {
            _id: null,
            totalAgencyEarnings: { $sum: "$agencyCoin" },
          },
        },
      ]),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            agencyId: agencyObjectId,
            type: { $in: [2, 3, 9, 10, 11, 12, 13] },
          },
        },
        {
          $group: {
            _id: null,
            totalAgencyUnderHostsEarning: { $sum: "$hostCoin" },
          },
        },
      ]),
    ]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    const totalAgencyEarnings = agencyEarnings.length > 0 ? agencyEarnings[0].totalAgencyEarnings : 0;
    const totalAgencyUnderHostsEarning = agencyHostEarnings.length > 0 ? agencyHostEarnings[0].totalAgencyUnderHostsEarning : 0;

    return res.status(200).json({
      status: true,
      message: "Get admin panel dashboard count.",
      data: {
        pendingHostApplications,
        totalHosts,
        activeHosts,
        suspendedHosts,
        hostsLiveNow: hostsLiveNow.length > 0 ? hostsLiveNow[0].total : 0,
        totalPayoutPending: totalPayoutPending.length > 0 ? totalPayoutPending[0].total : 0,
        totalPayoutCompleted: totalPayoutCompleted.length > 0 ? totalPayoutCompleted[0].total : 0,
        totalAgencyEarnings,
        totalAgencyUnderHostsEarning,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(200).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get new hosts
exports.retrieveRecentHosts = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const agencyObjectId = new mongoose.Types.ObjectId(req.agency._id);
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery.createdAt = {
        $gte: startDateObj,
        $lte: endDateObj,
      };
    }

    const filter = {
      ...dateFilterQuery,
      agencyId: agencyObjectId,
      isFake: false,
      status: 2,
      //coin: { $gt: 0 },
    };

    const [agency, recentHosts] = await Promise.all([
      Agency.findById(agencyObjectId).select("_id").lean(),
      Host.aggregate([
        { $match: filter },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            name: 1,
            image: 1,
            countryFlagImage: 1,
            country: 1,
            coin: 1,
            isOnline: 1,
            isBlock: 1,
            status: 1,
            createdAt: 1,
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
      ]),
    ]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Recent hosts retrieved successfully ✅",
      data: recentHosts,
    });
  } catch (error) {
    console.error("Error fetching top performers:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get top performing host
exports.listTopEarningHosts = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const agencyObjectId = new mongoose.Types.ObjectId(req.agency._id);
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery.createdAt = {
        $gte: startDateObj,
        $lte: endDateObj,
      };
    }

    const filter = {
      ...dateFilterQuery,
      agencyId: agencyObjectId,
      isFake: false,
      coin: { $gt: 0 },
    };

    const [agency, topHosts] = await Promise.all([
      Agency.findById(agencyObjectId).select("_id").lean(),
      Host.aggregate([
        { $match: filter },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            name: 1,
            image: 1,
            countryFlagImage: 1,
            country: 1,
            coin: 1,
            isOnline: 1,
            isBlock: 1,
            createdAt: 1,
          },
        },
        { $sort: { coin: -1 } },
        { $limit: 10 },
      ]),
    ]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Top performing hosts retrieved successfully ✅",
      data: topHosts,
    });
  } catch (error) {
    console.error("Error fetching top performers:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal Server Error",
    });
  }
};

//get earnings ( chart )
exports.getEarningsReport = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const agencyObjectId = new mongoose.Types.ObjectId(req.agency._id);

    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";
    const type = req?.query?.type?.trim().toLowerCase();

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const formatStartDate = new Date(startDate);
      const formatEndDate = new Date(endDate);
      formatEndDate.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: formatStartDate,
          $lte: formatEndDate,
        },
      };
    }

    if (type === "agencyearning") {
      const agencyEarnings = await History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            agencyId: agencyObjectId,
            type: { $in: [2, 3, 9, 10, 11, 12, 13] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            totalAgencyEarnings: { $sum: "$agencyCoin" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return res.status(200).json({ status: true, message: "Success", agencyEarnings });
    } else if (type === "hostearning") {
      const hostEarnings = await History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            agencyId: agencyObjectId,
            type: { $in: [2, 3, 9, 10, 11, 12, 13] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            totalHostEarnings: { $sum: "$hostCoin" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return res.status(200).json({ status: true, message: "Success", hostEarnings });
    } else {
      return res.status(200).json({ status: false, message: "Invalid type passed. Must be one of agencyearning, hostearning." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
