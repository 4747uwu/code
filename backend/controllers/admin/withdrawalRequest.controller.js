const WithdrawalRequest = require("../../models/withdrawalRequest.model");

//import model
const History = require("../../models/history.model");
const Agency = require("../../models/agency.model");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//get withdrawal requests ( hosts / agency )
exports.retrievePayoutRequests = async (req, res) => {
  try {
    const { status, person } = req.query;

    if (!status || !person) {
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

    const [totalRecords, records] = await Promise.all([
      WithdrawalRequest.countDocuments({
        ...personQuery,
        ...statusQuery,
        ...dateFilterQuery,
      }),
      WithdrawalRequest.find({
        ...personQuery,
        ...statusQuery,
        ...dateFilterQuery,
      })
        .populate("agencyId", "uniqueId name image")
        .populate("hostId", "uniqueId name image")
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

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

//accept or decline withdrawal requests ( agency )
exports.updateAgencyWithdrawalStatus = async (req, res) => {
  try {
    const { requestId, agencyId, type, reason } = req.query;

    if (!requestId || !agencyId || !type) {
      return res.status(200).json({ status: false, message: "Missing required parameters." });
    }

    const actionType = type.trim().toLowerCase();
    const dateNow = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    const [request, agency] = await Promise.all([
      WithdrawalRequest.findById(requestId).lean().select("_id agencyId coin amount status uniqueId"),
      Agency.findById(agencyId).lean().select("_id isBlock fcmToken"),
    ]);

    if (!request) return res.status(200).json({ status: false, message: "Withdrawal request not found." });
    if (!agency) return res.status(200).json({ status: false, message: "Agency not found." });
    if (agency.isBlock) return res.status(403).json({ status: false, message: "Agency is blocked by admin." });

    if (request.status === 2) return res.status(200).json({ status: false, message: "Request already approved." });
    if (request.status === 3) return res.status(200).json({ status: false, message: "Request already declined." });

    if (actionType === "approve") {
      res.status(200).json({
        status: true,
        message: "Withdrawal request approved successfully.",
      });

      await Promise.all([
        WithdrawalRequest.updateOne(
          { _id: request._id, person: 1, agencyId: agencyId },
          {
            $set: {
              status: 2,
              acceptOrDeclineDate: dateNow,
            },
          }
        ),
        History.updateOne(
          { uniqueId: request.uniqueId, type: 5 },
          {
            $set: {
              payoutStatus: 2,
              date: dateNow,
            },
          }
        ),
        Agency.updateOne(
          {
            _id: agencyId,
            netAvailableEarnings: { $gt: 0 },
          },
          {
            $inc: {
              netAvailableEarnings: -request.coin,
              totalWithdrawn: request.coin,
              totalWithdrawnAmount: request.amount,
            },
          }
        ),
      ]);

      if (agency.fcmToken) {
        const payload = {
          token: agency.fcmToken,
          notification: {
            title: "✅ Withdrawal Approved!",
            body: "🎉 Great news! Your withdrawal has been successfully approved. Keep up the great work! 💼💰",
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

      res.status(200).json({
        status: true,
        message: "Withdrawal request declined.",
      });

      await Promise.all([
        WithdrawalRequest.updateOne(
          { _id: request._id },
          {
            $set: {
              status: 3,
              reason: reason.trim(),
              acceptOrDeclineDate: dateNow,
            },
          }
        ),
        History.updateOne(
          { uniqueId: request.uniqueId, type: 5 },
          {
            $set: {
              payoutStatus: 3,
              reason,
              date: dateNow,
            },
          }
        ),
      ]);

      if (agency.fcmToken) {
        const payload = {
          token: agency.fcmToken,
          notification: {
            title: "❌ Withdrawal Declined",
            body: "⚠️ Your withdrawal request was declined. Please review the reason or contact support. 📩",
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
      return res.status(200).json({
        status: false,
        message: "Invalid type. Must be 'approve' or 'reject'.",
      });
    }
  } catch (error) {
    console.error("Error in handleAgencyWithdrawalStatus:", error);
    res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
