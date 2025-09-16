const WithdrawalRequest = require("../../models/withdrawalRequest.model");
const Host = require("../../models/host.model");
const History = require("../../models/history.model");

const mongoose = require("mongoose");

const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

const admin = require("../../util/privateKey");

//withdrawal request ( host )
exports.submitWithdrawalRequest = async (req, res) => {
  try {
    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Withdrawal settings not found." });
    }

    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "hostId missing or invalid." });
    }

    const { paymentGateway, paymentDetails, coin } = req.body;

    if (!paymentGateway || !paymentDetails || !coin) {
      return res.status(200).json({ status: false, message: "Invalid request. Please provide all required fields." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);
    const formattedGateway = paymentGateway.trim();
    const requestedCoins = Number(coin);
    const requestAmount = parseFloat(requestedCoins / settingJSON.minCoinsToConvert).toFixed(2);

    const [uniqueId, host, pendingRequest, declinedRequest] = await Promise.all([
      generateHistoryUniqueId(),
      Host.findOne({ _id: hostId }).select("_id coin fcmToken").lean(),
      WithdrawalRequest.findOne({ hostId, status: 1 }).select("_id").lean(), // status 1: pending
      WithdrawalRequest.findOne({ hostId, status: 3 }).select("_id").lean(), // status 3: declined
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host account not found." });
    }

    if (requestedCoins > host.coin) {
      return res.status(200).json({ status: false, message: "Insufficient balance to request withdrawal." });
    }

    if (requestedCoins < settingJSON.minCoinsForHostPayout) {
      return res.status(200).json({ status: false, message: `Minimum withdrawal amount is ${settingJSON.minCoinsForHostPayout} coins.` });
    }

    if (pendingRequest) {
      return res.status(200).json({
        status: false,
        message: "You already have a pending withdrawal request under review.",
      });
    }

    const withdrawalData = {
      uniqueId,
      person: 2,
      hostId: host._id,
      coin: requestedCoins,
      amount: requestAmount,
      paymentGateway: formattedGateway,
      paymentDetails: paymentDetails,
      requestDate: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    };

    console.log("paymentDetails type:", typeof paymentDetails);
    console.log("paymentDetails value:", paymentDetails);

    const historyData = {
      uniqueId,
      hostId: host._id,
      hostCoin: requestedCoins,
      payoutStatus: 1,
      type: 5,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    };

    if (declinedRequest) {
      res.status(200).json({
        status: true,
        message: "Previous declined request removed. New withdrawal request submitted successfully.",
      });

      await WithdrawalRequest.deleteOne({ _id: declinedRequest._id });
      await Promise.all([WithdrawalRequest.create(withdrawalData), History.create(historyData)]);
    } else {
      res.status(200).json({
        status: true,
        message: "Your withdrawal request has been submitted successfully and is under review.",
      });

      await Promise.all([WithdrawalRequest.create(withdrawalData), History.create(historyData)]);
    }

    if (host.fcmToken) {
      const adminApp = await admin;
      const notificationPayload = {
        token: host.fcmToken,
        notification: {
          title: "🔔 Withdrawal Request Submitted",
          body: "We have received your withdrawal request. It will be processed shortly.",
        },
        data: {
          type: "WITHDRAWREQUEST",
        },
      };

      adminApp
        .messaging()
        .send(notificationPayload)
        .then((response) => {
          console.log("Notification sent successfully:", response);
        })
        .catch((err) => {
          console.error("Notification sending failed:", err);
        });
    }
  } catch (err) {
    console.error("Withdrawal request error:", err);
    return res.status(500).json({ status: false, message: "Internal server error. Please try again later." });
  }
};

//get withdrawal requests ( host )
exports.listPayoutRequests = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "hostId missing or invalid." });
    }

    const { status } = req.query;

    if (!status) {
      return res.status(200).json({ status: false, message: "Invalid query parameters." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const formattedStartDate = new Date(startDate);
      const formattedEndDate = new Date(endDate);
      formattedEndDate.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: formattedStartDate,
          $lte: formattedEndDate,
        },
      };
    }

    let statusQuery = {};
    if (status !== "All") {
      statusQuery.status = parseInt(status);
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const [host, totalRecords, records] = await Promise.all([
      Host.findOne({ _id: hostId }).select("_id").lean(),
      WithdrawalRequest.countDocuments({ person: 2, hostId: hostId, ...statusQuery, ...dateFilterQuery }),
      WithdrawalRequest.find({ person: 2, hostId: hostId, ...statusQuery, ...dateFilterQuery })
        .populate("hostId", "uniqueId name image")
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host account not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Withdrawal requests retrieved successfully.",
      total: totalRecords,
      data: records.length > 0 ? records : [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
