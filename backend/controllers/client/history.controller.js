const History = require("../../models/history.model");
const Host = require("../../models/host.model");
const User = require("../../models/user.model");

const mongoose = require("mongoose");

//get coin history ( user )
exports.getCoinTransactionRecords = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Access denied. Invalid authentication token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

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

    const [transactionHistory] = await Promise.all([
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
            giftCoin: 1,
            giftCount: 1,
            userCoin: 1,
            payoutStatus: 1,
            createdAt: 1,
            receiverName: { $ifNull: ["$receiver.name", ""] },
            uniqueId: { $ifNull: ["$receiver.uniqueId", ""] },
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
        { $skip: (start - 1) * limit },
        { $limit: limit },
        { $sort: { createdAt: -1 } },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//get coin history ( host )
exports.retrieveHostCoinHistory = async (req, res) => {
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

    const [transactionHistory] = await Promise.all([
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
            giftCoin: 1,
            giftCount: 1,
            hostCoin: 1,
            payoutStatus: 1,
            createdAt: 1,
            senderName: { $ifNull: ["$sender.name", ""] },
            uniqueId: { $ifNull: ["$sender.uniqueId", ""] },
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};
