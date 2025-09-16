const History = require("../../models/history.model");
const User = require("../../models/user.model");
const Host = require("../../models/host.model");

//mongoose
const mongoose = require("mongoose");

//get coin history ( user )
exports.getCoinTransactionHistory = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    if (req.query.userId && !mongoose.Types.ObjectId.isValid(req.query.userId)) {
      return res.status(200).json({ status: false, message: "Invalid userId. Please provide a valid ObjectId." });
    }

    const userId = new mongoose.Types.ObjectId(req.query.userId);
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

    const [user, total, transactionHistory, incomeStats] = await Promise.all([
      User.findOne({ _id: userId }).select("_id").lean(),
      History.countDocuments({
        ...dateFilterQuery,
        type: { $nin: [5] },
        userId: userId,
        userCoin: { $ne: 0 },
      }),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $nin: [5] },
            userId: userId,
            userCoin: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "hostId",
            foreignField: "_id",
            as: "receiver",
          },
        },
        {
          $unwind: {
            path: "$receiver",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            typeDescription: {
              $switch: {
                branches: [
                  { case: { $eq: ["$type", 1] }, then: "Login Bonus" },
                  { case: { $eq: ["$type", 2] }, then: "Live Gift" },
                  { case: { $eq: ["$type", 3] }, then: "Video Call Gift" },
                  { case: { $eq: ["$type", 6] }, then: "Daily Check-in Reward" },
                  { case: { $eq: ["$type", 7] }, then: "Purchased Coin Plan" },
                  { case: { $eq: ["$type", 8] }, then: "VIP Plan Purchase" },
                  { case: { $eq: ["$type", 9] }, then: "Chat with Host" },
                  { case: { $eq: ["$type", 10] }, then: "Chat Gift" },
                  { case: { $eq: ["$type", 11] }, then: "Private Audio Call" },
                  { case: { $eq: ["$type", 12] }, then: "Private Video Call" },
                  { case: { $eq: ["$type", 13] }, then: "Random Video Call" },
                ],
                default: "❓ Unknown Type",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            type: 1,
            typeDescription: 1,
            userCoin: 1,
            adminCoin: 1,
            hostCoin: 1,
            agencyCoin: 1,
            payoutStatus: 1,
            createdAt: 1,
            receiverName: { $ifNull: ["$receiver.name", ""] },
            isIncome: {
              $cond: {
                if: { $in: ["$type", [1, 6, 7, 8]] },
                then: true,
                else: {
                  $cond: {
                    if: {
                      $in: ["$type", [2, 3, 10, 11, 12, 13]],
                    },
                    then: false,
                    else: false,
                  },
                },
              },
            },
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $nin: [5] },
            userId: userId,
            userCoin: { $ne: 0 },
          },
        },
        {
          $addFields: {
            isIncome: {
              $cond: {
                if: { $in: ["$type", [1, 6, 7, 8]] },
                then: true,
                else: {
                  $cond: {
                    if: {
                      $or: [{ $in: ["$type", [2, 3, 10, 11, 12, 13]] }, { $and: [{ $eq: ["$type", 4] }, { $eq: ["$payoutStatus", 2] }] }],
                    },
                    then: false,
                    else: false,
                  },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalIncome: {
              $sum: {
                $cond: [{ $eq: ["$isIncome", true] }, "$userCoin", 0],
              },
            },
            totalOutgoing: {
              $sum: {
                $cond: [{ $eq: ["$isIncome", false] }, "$userCoin", 0],
              },
            },
          },
        },
      ]),
    ]);

    if (!user) {
      return res.status(200).json({ status: false, message: "User does not found." });
    }

    const totalIncome = incomeStats.length ? incomeStats[0].totalIncome : 0;
    const totalOutgoing = incomeStats.length ? incomeStats[0].totalOutgoing : 0;

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      totalIncome,
      totalOutgoing,
      total: total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//get call history ( user )
exports.fetchCallTransactionHistory = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "❌ Invalid details." });
    }

    if (req.query.userId && !mongoose.Types.ObjectId.isValid(req.query.userId)) {
      return res.status(200).json({ status: false, message: "Invalid userId. Please provide a valid ObjectId." });
    }

    const userId = new mongoose.Types.ObjectId(req.query.userId);
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

    const [user, total, transactionHistory] = await Promise.all([
      User.findOne({ _id: userId }).select("_id").lean(),
      History.countDocuments({
        ...dateFilterQuery,
        type: { $in: [11, 12, 13] },
        userId: userId,
        userCoin: { $ne: 0 },
      }),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $in: [11, 12, 13] },
            userId: userId,
            userCoin: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "hostId",
            foreignField: "_id",
            as: "receiver",
          },
        },
        {
          $unwind: {
            path: "$receiver",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            typeDescription: {
              $switch: {
                branches: [
                  { case: { $eq: ["$type", 11] }, then: "Private Audio Call" },
                  { case: { $eq: ["$type", 12] }, then: "Private Video Call" },
                  { case: { $eq: ["$type", 13] }, then: "Random Video Call" },
                ],
                default: "❓ Unknown Type",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            type: 1,
            typeDescription: 1,
            userCoin: 1,
            adminCoin: 1,
            hostCoin: 1,
            agencyCoin: 1,
            callType: 1,
            isRandom: 1,
            isPrivate: 1,
            callStartTime: 1,
            callEndTime: 1,
            duration: 1,
            createdAt: 1,
            receiverName: { $ifNull: ["$receiver.name", ""] },
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    if (!user) {
      return res.status(200).json({ status: false, message: "👤 User not found." });
    }

    return res.status(200).json({
      status: true,
      message: "✅ Transaction history fetched successfully.",
      total: total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "🚨 Something went wrong. Please try again later.",
    });
  }
};

//get gift history ( user )
exports.retrieveGiftTransactionHistory = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "❌ Invalid details." });
    }

    if (req.query.userId && !mongoose.Types.ObjectId.isValid(req.query.userId)) {
      return res.status(200).json({ status: false, message: "Invalid userId. Please provide a valid ObjectId." });
    }

    const userId = new mongoose.Types.ObjectId(req.query.userId);
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

    const [user, total, transactionHistory] = await Promise.all([
      User.findOne({ _id: userId }).select("_id").lean(),
      History.countDocuments({
        ...dateFilterQuery,
        type: { $in: [2, 3, 10] },
        userId: userId,
        userCoin: { $ne: 0 },
      }),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $in: [2, 3, 10] },
            userId: userId,
            userCoin: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "hostId",
            foreignField: "_id",
            as: "receiver",
          },
        },
        {
          $unwind: {
            path: "$receiver",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            typeDescription: {
              $switch: {
                branches: [
                  { case: { $eq: ["$type", 2] }, then: "Live Gift" },
                  { case: { $eq: ["$type", 3] }, then: "Video Call Gift" },
                  { case: { $eq: ["$type", 10] }, then: "Chat Gift" },
                ],
                default: "❓ Unknown Type",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            type: 1,
            typeDescription: 1,
            userCoin: 1,
            adminCoin: 1,
            hostCoin: 1,
            agencyCoin: 1,
            createdAt: 1,
            receiverName: { $ifNull: ["$receiver.name", ""] },
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    if (!user) {
      return res.status(200).json({ status: false, message: "👤 User not found." });
    }

    return res.status(200).json({
      status: true,
      message: "✅ Transaction history fetched successfully.",
      total: total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "🚨 Something went wrong. Please try again later.",
    });
  }
};

//get vipPlan purchase history ( user )
exports.getVIPPlanTransactionHistory = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    if (req.query.userId && !mongoose.Types.ObjectId.isValid(req.query.userId)) {
      return res.status(200).json({ status: false, message: "Invalid userId. Please provide a valid ObjectId." });
    }

    const userId = new mongoose.Types.ObjectId(req.query.userId);
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

    const [user, total, transactionHistory] = await Promise.all([
      User.findOne({ _id: userId }).select("_id").lean(),
      History.countDocuments({
        ...dateFilterQuery,
        type: 8,
        userId: userId,
        userCoin: { $ne: 0 },
      }),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: 8,
            userId: userId,
            userCoin: { $ne: 0 },
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            type: 1,
            userCoin: 1,
            validity: 1,
            validityType: 1,
            price: 1,
            paymentGateway: 1,
            createdAt: 1,
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    if (!user) {
      return res.status(200).json({ status: false, message: "User does not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      total: total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//get coinplan purchase history ( user )
exports.fetchCoinPlanTransactionHistory = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    if (req.query.userId && !mongoose.Types.ObjectId.isValid(req.query.userId)) {
      return res.status(200).json({ status: false, message: "Invalid userId. Please provide a valid ObjectId." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const startDate = req?.query?.startDate || "All";
    const endDate = req?.query?.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const formatStartDate = new Date(startDate);
      const formatEndDate = new Date(endDate);
      formatEndDate.setHours(23, 59, 59, 999);

      dateFilterQuery.createdAt = {
        $gte: formatStartDate,
        $lte: formatEndDate,
      };
    }

    const baseFilter = {
      ...dateFilterQuery,
      type: 7,
      userCoin: { $exists: true, $ne: 0 },
      price: { $exists: true, $ne: 0 },
      userId: new mongoose.Types.ObjectId(req.query.userId),
    };

    const [history] = await Promise.all([
      History.aggregate([
        { $match: baseFilter },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $group: {
            _id: "$userDetails._id",
            name: { $first: "$userDetails.name" },
            name: { $first: "$userDetails.uniqueId" },
            isVip: { $first: "$userDetails.isVip" },
            image: { $first: "$userDetails.image" },
            totalPlansPurchased: { $sum: 1 },
            totalPriceSpent: { $sum: "$price" },
            coinPlanPurchase: {
              $push: {
                uniqueId: "$uniqueId",
                coin: "$userCoin",
                bonusCoins: "$bonusCoins",
                price: "$price",
                paymentGateway: "$paymentGateway",
                date: "$date",
              },
            },
          },
        },
        { $sort: { totalPlansPurchased: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]).then((result) => result.map((doc) => ({ ...doc, _id: doc._id.toString() }))),
    ]);

    return res.status(200).json({
      status: true,
      message: "User coin plan transactions retrieved successfully.",
      total: history.length || 0,
      data: history || [],
    });
  } catch (error) {
    console.error("Error fetching coin plan transactions:", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

//get coin history ( host )
exports.fetchCoinTransactionHistory = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    if (req.query.hostId && !mongoose.Types.ObjectId.isValid(req.query.hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId. Please provide a valid ObjectId." });
    }

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

    const [host, total, transactionHistory] = await Promise.all([
      Host.findOne({ _id: hostId }).select("_id").lean(),
      History.countDocuments({
        ...dateFilterQuery,
        type: { $in: [2, 3, 5, 9, 10, 11, 12, 13] },
        hostId: hostId,
        hostCoin: { $ne: 0 },
      }),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $in: [2, 3, 5, 9, 10, 11, 12, 13] },
            hostId: hostId,
            hostCoin: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "sender",
          },
        },
        {
          $unwind: {
            path: "$sender",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            typeDescription: {
              $switch: {
                branches: [
                  { case: { $eq: ["$type", 2] }, then: "Live Gift" },
                  { case: { $eq: ["$type", 3] }, then: "Video Call Gift" },
                  { case: { $eq: ["$type", 5] }, then: "Withdrawal by Host" },
                  { case: { $eq: ["$type", 9] }, then: "Chat with Host" },
                  { case: { $eq: ["$type", 10] }, then: "Chat Gift" },
                  { case: { $eq: ["$type", 11] }, then: "Private Audio Call" },
                  { case: { $eq: ["$type", 12] }, then: "Private Video Call" },
                  { case: { $eq: ["$type", 13] }, then: "Random Video Call" },
                ],
                default: "❓ Unknown Type",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            type: 1,
            typeDescription: 1,
            userCoin: 1,
            adminCoin: 1,
            hostCoin: 1,
            agencyCoin: 1,
            payoutStatus: 1,
            createdAt: 1,
            senderName: { $ifNull: ["$sender.name", ""] },
            isIncome: {
              $cond: {
                if: { $in: ["$type", [2, 3, 9, 10, 11, 12, 13]] },
                then: true,
                else: {
                  $cond: {
                    if: {
                      $and: [{ $eq: ["$type", 5] }, { $eq: ["$payoutStatus", 2] }],
                    },
                    then: false,
                    else: false,
                  },
                },
              },
            },
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host does not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      total: total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//get call history ( host )
exports.listCallTransactions = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
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

    const [host, total, transactionHistory] = await Promise.all([
      Host.findOne({ _id: hostId }).select("_id").lean(),
      History.countDocuments({
        ...dateFilterQuery,
        type: { $in: [11, 12, 13] },
        hostId: hostId,
        hostCoin: { $ne: 0 },
      }),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $in: [11, 12, 13] },
            hostId: hostId,
            hostCoin: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "sender",
          },
        },
        {
          $unwind: {
            path: "$sender",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            typeDescription: {
              $switch: {
                branches: [
                  { case: { $eq: ["$type", 11] }, then: "Private Audio Call" },
                  { case: { $eq: ["$type", 12] }, then: "Private Video Call" },
                  { case: { $eq: ["$type", 13] }, then: "Random Video Call" },
                ],
                default: "❓ Unknown Type",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            type: 1,
            typeDescription: 1,
            userCoin: 1,
            adminCoin: 1,
            hostCoin: 1,
            agencyCoin: 1,
            callType: 1,
            isRandom: 1,
            isPrivate: 1,
            callStartTime: 1,
            callEndTime: 1,
            duration: 1,
            createdAt: 1,
            senderName: { $ifNull: ["$sender.name", ""] },
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host does not found." });
    }

    return res.status(200).json({
      status: true,
      message: "✅ Transaction history fetched successfully.",
      total: total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "🚨 Something went wrong. Please try again later.",
    });
  }
};

//get gift history ( host )
exports.fetchGiftTransactionHistory = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
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

    const [host, total, transactionHistory] = await Promise.all([
      Host.findOne({ _id: hostId }).select("_id").lean(),
      History.countDocuments({
        ...dateFilterQuery,
        type: { $in: [2, 3, 10] },
        hostId: hostId,
        hostCoin: { $ne: 0 },
      }),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $in: [2, 3, 10] },
            hostId: hostId,
            hostCoin: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "sender",
          },
        },
        {
          $unwind: {
            path: "$sender",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            typeDescription: {
              $switch: {
                branches: [
                  { case: { $eq: ["$type", 2] }, then: "Live Gift" },
                  { case: { $eq: ["$type", 3] }, then: "Video Call Gift" },
                  { case: { $eq: ["$type", 10] }, then: "Chat Gift" },
                ],
                default: "❓ Unknown Type",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            type: 1,
            typeDescription: 1,
            userCoin: 1,
            adminCoin: 1,
            hostCoin: 1,
            agencyCoin: 1,
            createdAt: 1,
            senderName: { $ifNull: ["$sender.name", ""] },
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host does not found." });
    }

    return res.status(200).json({
      status: true,
      message: "✅ Transaction history fetched successfully.",
      total: total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "🚨 Something went wrong. Please try again later.",
    });
  }
};
