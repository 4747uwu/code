const Host = require("../../models/host.model");
const Agency = require("../../models/agency.model");
const User = require("../../models/user.model");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//get host requests
exports.fetchHostRequestsByAgency = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.query.status) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details!" });
    }

    const status = parseInt(req.query.status);
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const agencyId = new mongoose.Types.ObjectId(req.agency._id);

    const [agency, totalHosts, hosts] = await Promise.all([
      Agency.findOne({ _id: agencyId }).lean(),
      Host.countDocuments({ agencyId: agencyId, status: status, isBlock: false, isFake: false }),
      Host.find({ agencyId: agencyId, status: status, isBlock: false, isFake: false })
        .select(
          "_id name gender image photoGallery impression identityProofType identityProof uniqueId isOnline isBusy isLive age email dob bio language countryFlagImage country userId reason createdAt"
        )
        .skip((start - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
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
      message: "Agency wise hosts fetched successfully!",
      totalHosts: totalHosts,
      hosts: hosts,
    });
  } catch (error) {
    console.error("Error fetching agency wise hosts:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//accept Or decline host request
exports.manageHostRequest = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Setting not found." });
    }

    const { requestId, userId, status, reason } = req.query;

    if (!requestId || !userId || !status) {
      return res.status(200).json({ status: false, message: "Invalid details provided." });
    }

    const agencyObjectId = new mongoose.Types.ObjectId(req.agency._id);
    const hostObjectId = new mongoose.Types.ObjectId(requestId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const statusNumber = Number(status);

    const [agency, host] = await Promise.all([Agency.findOne({ _id: agencyObjectId }).select("_id").lean(), Host.findOne({ _id: hostObjectId, agencyId: agencyObjectId })]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found!" });
    }

    if (agency.isBlock) {
      return res.status(200).json({ status: false, message: "You are blocked by the admin!" });
    }

    if (!host) {
      return res.status(200).json({ status: false, message: "Host request not found." });
    }

    if (host.status === 2) {
      return res.status(200).json({ status: false, message: "Host request has already been accepted." });
    }

    if (host.status === 3) {
      return res.status(200).json({ status: false, message: "Host request has already been rejected." });
    }

    if (statusNumber === 2) {
      host.status = 2;
      host.randomCallRate = settingJSON.generalRandomCallRate;
      host.randomCallFemaleRate = settingJSON.femaleRandomCallRate;
      host.randomCallMaleRate = settingJSON.maleRandomCallRate;
      host.privateCallRate = settingJSON.videoPrivateCallRate;
      host.audioCallRate = settingJSON.audioPrivateCallRate;
      host.chatRate = settingJSON.chatInteractionRate;
      await host.save();

      res.status(200).json({ status: true, message: "Host request accepted successfully.", data: host });

      const user = await User.findOne({ _id: userObjectId }).select("isHost hostId");
      if (user) {
        user.isHost = true;
        user.hostId = host._id;
        await user.save();
      }

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          notification: {
            title: "🎉 Host Verification Successful!",
            body: "Congratulations! Your host request has been approved. You’re now ready to go live! 🚀",
          },
        };

        try {
          const adminInstance = await admin;
          await adminInstance.messaging().send(payload);
          console.log("Notification sent successfully.");
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      }
    } else if (statusNumber === 3) {
      if (!reason || reason.trim() === "") {
        return res.status(200).json({ status: false, message: "Please provide a reason for rejection." });
      }

      host.status = 3;
      host.reason = reason.trim();
      await host.save();

      res.status(200).json({ status: true, message: "Host request rejected successfully.", data: host });

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          notification: {
            title: "❌ Host Request Declined",
            body: "Unfortunately, your host request was declined. Please check your details or contact support for assistance. 📩",
          },
        };

        try {
          const adminInstance = await admin;
          await adminInstance.messaging().send(payload);
          console.log("Notification sent successfully.");
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      }
    } else {
      return res.status(200).json({ status: false, message: "Invalid status value provided." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error", error: error.message });
  }
};

//get hosts
exports.retrieveAgencyHosts = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const agencyId = new mongoose.Types.ObjectId(req.agency._id);

    const [agency, total, hosts] = await Promise.all([
      Agency.findOne({ _id: agencyId }).select("_id isBlock").lean(),
      Host.countDocuments({
        agencyId,
        status: 2,
        isFake: false,
      }),
      Host.aggregate([
        {
          $match: {
            agencyId,
            status: 2,
            isFake: false,
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from: "followerfollowings", // must match collection name
            localField: "_id",
            foreignField: "followingId",
            as: "followers",
          },
        },
        {
          $addFields: {
            totalFollowers: { $size: "$followers" },
          },
        },
        {
          $project: {
            name: 1,
            coin: 1,
            gender: 1,
            image: 1,
            impression: 1,
            identityProofType: 1,
            uniqueId: 1,
            isOnline: 1,
            isBusy: 1,
            isLive: 1,
            countryFlagImage: 1,
            country: 1,
            totalFollowers: 1,
            createdAt: 1,
          },
        },
      ]),
    ]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found!" });
    }

    if (agency.isBlock) {
      return res.status(200).json({ status: false, message: "You are blocked by the admin!" });
    }

    return res.status(200).json({
      status: true,
      message: "Agency wise hosts fetched successfully!",
      total,
      hosts,
    });
  } catch (error) {
    console.error("Error fetching agency wise hosts:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//handle block or not the host
exports.modifyHostBlockStatus = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { hostId } = req.query;

    if (!hostId) {
      return res.status(200).json({ status: false, message: "Host ID is required!" });
    }

    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId format." });
    }

    const agencyId = new mongoose.Types.ObjectId(req.agency._id);

    const [agency, host] = await Promise.all([Agency.findOne({ _id: agencyId }).select("_id").lean(), Host.findOne({ _id: hostId, agencyId: agencyId })]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found!" });
    }

    if (agency.isBlock) {
      return res.status(200).json({ status: false, message: "You are blocked by the admin!" });
    }

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    host.isBlock = !host.isBlock;
    await host.save();

    return res.status(200).json({
      status: true,
      message: `Host has been ${host.isBlock ? "blocked" : "unblocked"} successfully.`,
      data: host,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error", error: error.message });
  }
};
