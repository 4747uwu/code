const WithdrawalRequest = require("../../models/withdrawalRequest.model");

//import model
const Agency = require("../../models/agency.model");
const History = require("../../models/history.model");
const Host = require("../../models/host.model");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//get withdrawal requests ( hosts / agency )
exports.fetchPayoutRequests = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { status, person } = req.query;

    if (!status || !person) {
      return res.status(200).json({ status: false, message: "Invalid query parameters." });
    }

    const agencyId = new mongoose.Types.ObjectId(req.agency._id);
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

    let personQuery = {};
    if (person !== "All") {
      const personValue = parseInt(person);
      personQuery.person = personValue;

      if (personValue === 1) {
        personQuery.agencyId = { $ne: null };
      } else if (personValue === 2) {
        personQuery.hostId = { $ne: null };
      }
    }

    const [agency, totalRecords, records] = await Promise.all([
      Agency.findOne({ _id: agencyId }).select("_id").lean(),
      WithdrawalRequest.countDocuments({ ...personQuery, ...statusQuery, ...dateFilterQuery }),
      WithdrawalRequest.find({ ...personQuery, ...statusQuery, ...dateFilterQuery })
        .populate("agencyId", "uniqueId name image")
        .populate({
          path: "hostId",
          select: "uniqueId name image",
          match: { agencyId: agencyId }, // Match host's agency with agencyId
        })
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found!" });
    }

    if (agency.isBlock) {
      return res.status(200).json({ status: false, message: "You are blocked by the admin!" });
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

//accept or decline withdrawal requests ( host )
exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { requestId, hostId, type, reason } = req.query;

    if (!requestId || !hostId || !type) {
      return res.status(200).json({ status: false, message: "Missing required parameters." });
    }

    const actionType = type.trim().toLowerCase();
    const dateNow = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    const [request, host] = await Promise.all([
      WithdrawalRequest.findById(requestId).lean().select("_id hostId coin amount status uniqueId"),
      Host.findById(hostId).lean().select("_id isBlock fcmToken"),
    ]);

    if (!request) return res.status(200).json({ status: false, message: "Withdrawal request not found." });
    if (!host) return res.status(200).json({ status: false, message: "Host not found." });
    if (host.isBlock) return res.status(403).json({ status: false, message: "Host is blocked by admin." });

    if (request.status === 2) return res.status(200).json({ status: false, message: "Request already approved." });
    if (request.status === 3) return res.status(200).json({ status: false, message: "Request already declined." });

    if (actionType === "approve") {
      const [updateRequest, updateHost, updateHistory] = await Promise.all([
        WithdrawalRequest.updateOne(
          { _id: request._id, person: 2, hostId: hostId },
          {
            $set: {
              status: 2,
              acceptOrDeclineDate: dateNow,
            },
          }
        ),
        Host.updateOne(
          { _id: request.hostId, coin: { $gt: 0 } },
          {
            $inc: {
              coin: -request.coin,
              redeemedCoins: request.coin,
              redeemedAmount: request.amount,
            },
          }
        ),
        History.updateOne(
          { uniqueId: request.uniqueId, type: 5, hostId: hostId },
          {
            $set: {
              payoutStatus: 2,
              date: dateNow,
            },
          }
        ),
      ]);

      res.status(200).json({
        status: true,
        message: "Withdrawal request approved successfully.",
        data: updateRequest,
      });

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          notification: {
            title: "🔔 Withdrawal Request Accepted!",
            body: "Your withdrawal request has been approved and processed. 🎉",
          },
          data: { type: "WITHDRAWREQUEST" },
        };

        const adminInstance = await admin;
        adminInstance
          .messaging()
          .send(payload)
          .catch((err) => {
            console.error("FCM error:", err.message);
          });
      }
    } else if (actionType === "reject") {
      if (!reason) {
        return res.status(200).json({ status: false, message: "Rejection reason is required." });
      }

      const [updateRequest, updateHistory] = await Promise.all([
        WithdrawalRequest.updateOne(
          { _id: request._id, person: 2, hostId: hostId },
          {
            $set: {
              status: 3,
              reason: reason.trim(),
              acceptOrDeclineDate: dateNow,
            },
          }
        ),
        History.updateOne(
          { uniqueId: request.uniqueId, type: 5, hostId: hostId },
          {
            $set: {
              payoutStatus: 3,
              reason,
              date: dateNow,
            },
          }
        ),
      ]);

      res.status(200).json({
        status: true,
        message: "Withdrawal request declined.",
        data: updateRequest,
      });

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          notification: {
            title: "🔔 Withdrawal Request Declined!",
            body: "Your withdrawal request has been declined. Please contact support.",
          },
          data: { type: "WITHDRAWREQUEST" },
        };

        const adminInstance = await admin;
        adminInstance
          .messaging()
          .send(payload)
          .catch((err) => {
            console.error("FCM error:", err.message);
          });
      }
    } else {
      return res.status(200).json({ status: false, message: "Invalid type. Must be 'approve' or 'reject'." });
    }
  } catch (error) {
    console.error("Error in withdrawal request handler:", error);
    res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//submit withdrawal request ( agency )
exports.initiateWithdrawal = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Withdrawal settings not found." });
    }

    const { paymentGateway, paymentDetails, coin } = req.body;

    if (!paymentGateway || !paymentDetails || !coin) {
      return res.status(200).json({ status: false, message: "Invalid request. Please provide all required fields." });
    }

    const agencyId = new mongoose.Types.ObjectId(req.agency._id);
    const formattedGateway = paymentGateway.trim();
    const requestedCoins = Number(coin);
    const requestAmount = parseFloat(requestedCoins / settingJSON.minCoinsToConvert).toFixed(2);

    const [uniqueId, agency, pendingRequest, declinedRequest] = await Promise.all([
      generateHistoryUniqueId(),
      Agency.findOne({ _id: agencyId }).select("_id netAvailableEarnings").lean(),
      WithdrawalRequest.findOne({ agencyId, status: 1 }).select("_id").lean(), // status 1: pending
      WithdrawalRequest.findOne({ agencyId, status: 3 }).select("_id").lean(), // status 3: declined
    ]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found!" });
    }

    if (agency.isBlock) {
      return res.status(200).json({ status: false, message: "You are blocked by the admin!" });
    }

    if (requestedCoins > agency.netAvailableEarnings) {
      return res.status(200).json({ status: false, message: "Insufficient balance to request withdrawal." });
    }

    if (requestedCoins < settingJSON.minCoinsForAgencyPayout) {
      return res.status(200).json({ status: false, message: `Minimum withdrawal amount is ${settingJSON.minCoinsForAgencyPayout} coins.` });
    }

    if (pendingRequest) {
      return res.status(200).json({
        status: false,
        message: "You already have a pending withdrawal request under review.",
      });
    }

    const withdrawalData = {
      uniqueId,
      person: 1,
      agencyId: agency._id,
      coin: requestedCoins,
      amount: requestAmount,
      paymentGateway: formattedGateway,
      paymentDetails: paymentDetails,
      requestDate: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    };

    console.log("paymentDetails type:", typeof paymentDetails);
    console.log("paymentDetails value:", paymentDetails);

    if (declinedRequest) {
      res.status(200).json({
        status: true,
        message: "Previous declined request removed. New withdrawal request submitted successfully.",
        withdrawalRequest: withdrawalData,
      });

      await WithdrawalRequest.deleteOne({ _id: declinedRequest._id });
      await Promise.all([WithdrawalRequest.create(withdrawalData)]);
    } else {
      res.status(200).json({
        status: true,
        message: "Your withdrawal request has been submitted successfully and is under review.",
        withdrawalRequest: withdrawalData,
      });

      await Promise.all([WithdrawalRequest.create(withdrawalData)]);
    }
  } catch (err) {
    console.error("Withdrawal request error:", err);
    return res.status(500).json({ status: false, message: "Internal server error. Please try again later." });
  }
};
