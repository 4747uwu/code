const Host = require("../../models/host.model");

//import model
const Agency = require("../../models/agency.model");
const Impression = require("../../models/impression.model");
const History = require("../../models/history.model");
const LiveBroadcaster = require("../../models/liveBroadcaster.model");
const Block = require("../../models/block.model");
const HostMatchHistory = require("../../models/hostMatchHistory.model");
const FollowerFollowing = require("../../models/followerFollowing.model");

//deleteFiles
const { deleteFiles } = require("../../util/deletefile");

//generateUniqueId
const generateUniqueId = require("../../util/generateUniqueId");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//fs
const fs = require("fs");

//get impression list
exports.getPersonalityImpressions = async (req, res) => {
  try {
    const personalityImpressions = await Impression.find({}).select("name").sort({ createdAt: -1 }).lean();

    res.status(200).json({
      status: true,
      message: `Personality impressions retrieved successfully.`,
      personalityImpressions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Failed to retrieve personality impressions." });
  }
};

//validate agencyCode ( user )
exports.validateAgencyCode = async (req, res) => {
  try {
    const { agencyCode } = req.query;

    if (!agencyCode) {
      return res.status(200).json({ status: false, message: "Agency code is required." });
    }

    const agencyExists = await Agency.exists({ agencyCode: agencyCode });

    if (agencyExists) {
      return res.status(200).json({ status: true, message: "Valid agency code.", isValid: true });
    } else {
      return res.status(200).json({ status: false, message: "Invalid agency code.", isValid: false });
    }
  } catch (error) {
    console.error("Error validating agency code:", error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//host request ( user )
exports.initiateHostRequest = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const { email, fcmToken, name, bio, dob, gender, countryFlagImage, country, language, impression, agencyCode, identityProofType } = req.body;

    if (!email || !fcmToken || !name || !bio || !dob || !gender || !countryFlagImage || !country || !impression || !language || !identityProofType || !req.files) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    if (!req.files.identityProof) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Identity proof is missing. Please upload a valid file." });
    }

    if (!req.files.photoGallery) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Photo gallery is missing. Please upload the required photos." });
    }

    if (!req.files.image) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Image is missing. Please upload a valid image." });
    }

    const [uniqueId, agencyDetails, existingHost, declineHostRequest] = await Promise.all([
      generateUniqueId(),
      agencyCode ? Agency.findOne({ agencyCode: agencyCode }).select("_id").lean() : null,
      Host.findOne({ status: 1, userId: userId }).select("_id").lean(),
      Host.findOne({ status: 3, userId: userId }).select("_id").lean(),
    ]);

    if (existingHost) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops! A host request already exists under an agency." });
    }

    if (agencyCode && !agencyDetails) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Invalid agency ID." });
    }

    res.status(200).json({
      status: true,
      message: "Host request successfully sent.",
    });

    if (declineHostRequest) {
      await Host.findByIdAndDelete(declineHostRequest);
    }

    const impressions = typeof impression === "string" ? impression.split(",").map((topic) => topic.trim()) : [];
    const languages = typeof language === "string" ? language.split(",").map((lang) => lang.trim()) : [];

    const newHost = new Host({
      email,
      fcmToken,
      userId,
      agencyId: agencyDetails ? agencyDetails._id : null,
      name,
      bio,
      dob,
      gender,
      countryFlagImage,
      country,
      language: languages,
      impression: impressions,
      identityProofType,
      identityProof: req.files.identityProof?.map((file) => file.path) || [],
      image: req.files.image ? req.files.image[0].path : "",
      photoGallery: req.files.photoGallery?.map((file) => file.path) || [],
      uniqueId,
      status: 1,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    });

    await newHost.save();

    if (fcmToken && fcmToken !== null) {
      const payload = {
        token: fcmToken,
        notification: {
          title: "🎙️ Host Application Received 🚀",
          body: "Thank you for applying as a host! Our team is reviewing your request, and we'll update you soon. Stay tuned! 🤝✨",
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
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get host's request status ( user )
exports.verifyHostRequestStatus = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const host = await Host.findOne({ userId: userId }).select("status").lean();
    if (!host) {
      return res.status(200).json({ status: false, message: "Request not found for that user!" });
    }

    return res.status(200).json({
      status: true,
      message: "Request status retrieved successfully",
      data: host?.status,
    });
  } catch (error) {
    console.error("Error fetching request status:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get host thumblist ( user )
exports.retrieveHosts = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Configuration settings not found." });
    }

    if (!req.query.country) {
      return res.status(200).json({ status: false, message: "Please provide a country name." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const country = req.query.country.trim().toLowerCase();
    const isGlobal = country === "global";

    const fakeMatchQuery = isGlobal ? { isFake: true, isBlock: false, userId: { $ne: userId } } : { country: country, isFake: true, isBlock: false, userId: { $ne: userId } };
    const matchQuery = isGlobal ? { isFake: false, isBlock: false, status: 2, userId: { $ne: userId } } : { country: country, isFake: false, isBlock: false, status: 2, userId: { $ne: userId } };

    const [fakeHost, host, followedHost, liveHost, fakeLiveHost] = await Promise.all([
      Host.aggregate([
        { $match: fakeMatchQuery },
        {
          $lookup: {
            from: "blocks",
            let: { hostId: "$_id", userId: userId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
                  },
                },
              },
            ],
            as: "blockInfo",
          },
        },
        {
          $match: {
            blockInfo: { $eq: [] },
          },
        },
        {
          $addFields: {
            status: {
              $switch: {
                branches: [
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
                ],
                default: "Offline",
              },
            },
            audioCallRate: 0,
            privateCallRate: 0,
            liveHistoryId: "",
            token: "",
            channel: "",
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            audioCallRate: 1,
            privateCallRate: 1,
            isFake: 1,
            status: 1,
            video: 1,
            liveHistoryId: 1,
            token: 1,
            channel: 1,
          },
        },
      ]),
      Host.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: "blocks",
            let: { hostId: "$_id", userId: userId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
                  },
                },
              },
            ],
            as: "blockInfo",
          },
        },
        {
          $match: {
            blockInfo: { $eq: [] },
          },
        },
        {
          $addFields: {
            status: {
              $switch: {
                branches: [
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
                ],
                default: "Offline",
              },
            },
            statusOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ["$status", "Online"] }, then: 1 },
                  { case: { $eq: ["$status", "Live"] }, then: 2 },
                  { case: { $eq: ["$status", "Busy"] }, then: 3 },
                ],
                default: 4, // Offline
              },
            },
          },
        },
        {
          $sort: {
            statusOrder: 1, //Sort by priority
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            audioCallRate: 1,
            privateCallRate: 1,
            isFake: 1,
            status: 1,
          },
        },
      ]),
      Host.aggregate([
        {
          $lookup: {
            from: "followerfollowings",
            let: { hostId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ["$followerId", userId] }, { $eq: ["$followingId", "$$hostId"] }],
                  },
                },
              },
            ],
            as: "followInfo",
          },
        },
        {
          $match: {
            followInfo: { $ne: [] },
            isFake: false,
            isBlock: false,
            status: 2,
            userId: { $ne: userId },
          },
        },
        {
          $lookup: {
            from: "blocks",
            let: { hostId: "$_id", userId: userId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
                  },
                },
              },
            ],
            as: "blockInfo",
          },
        },
        {
          $match: {
            blockInfo: { $eq: [] },
          },
        },
        {
          $addFields: {
            isFollowed: { $gt: [{ $size: "$followInfo" }, 0] },
            status: {
              $switch: {
                branches: [
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
                ],
                default: "Offline",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            audioCallRate: 1,
            privateCallRate: 1,
            isFake: 1,
            status: 1,
          },
        },
      ]),
      LiveBroadcaster.aggregate([
        {
          $match: {
            userId: { $ne: userId },
          },
        },
        {
          $lookup: {
            from: "blocks",
            let: { hostId: "$_id", userId: userId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
                  },
                },
              },
            ],
            as: "blockInfo",
          },
        },
        {
          $match: {
            blockInfo: { $eq: [] },
          },
        },
        {
          $addFields: {
            video: "",
          },
        },
        {
          $project: {
            _id: 1,
            hostId: 1,
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            isFake: 1,
            liveHistoryId: 1,
            channel: 1,
            token: 1,
            view: 1,
            video: 1,
          },
        },
      ]),
      Host.aggregate([
        {
          $match: {
            isFake: true,
            isBlock: false,
            isLive: true,
            video: { $ne: "" },
            userId: { $ne: userId },
          },
        },
        {
          $lookup: {
            from: "blocks",
            let: { hostId: "$_id", userId: userId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
                  },
                },
              },
            ],
            as: "blockInfo",
          },
        },
        {
          $match: {
            blockInfo: { $eq: [] },
          },
        },
        {
          $project: {
            _id: 1,
            hostId: "$_id",
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            isFake: 1,
            liveHistoryId: 1,
            channel: 1,
            token: 1,
            view: 1,
            video: 1,
          },
        },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Hosts list retrieved successfully.",
      followedHost,
      liveHost: settingJSON.isDemoData ? [...fakeLiveHost, ...liveHost] : liveHost,
      hosts: settingJSON.isDemoData ? [...fakeHost, ...host] : host,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching the hosts list.",
      error: error.message || "Internal Server Error",
    });
  }
};

//get host profile ( user )
exports.retrieveHostDetails = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({ status: false, message: "Valid userId is required." });
    }

    const [host, receivedGifts, isFollowing, totalFollower] = await Promise.all([
      Host.findOne({ _id: hostId, isBlock: false })
        .select(
          "name email gender bio uniqueId countryFlagImage country impression language image photoGallery randomCallRate randomCallFemaleRate randomCallMaleRate privateCallRate audioCallRate chatRate coin"
        )
        .lean(),
      History.aggregate([
        { $match: { hostId: hostId, giftId: { $ne: null } } },
        {
          $group: {
            _id: "$giftId",
            totalReceived: { $sum: "$giftCount" },
            lastReceivedAt: { $max: "$createdAt" },
            giftCoin: { $first: "$giftCoin" },
            giftImage: { $first: "$giftImage" },
            giftType: { $first: "$giftType" },
          },
        },
        {
          $project: {
            giftId: "$_id",
            giftCoin: { $ifNull: ["$giftCoin", 0] },
            giftImage: 1,
            giftType: 1,
            totalReceived: 1,
            lastReceivedAt: 1,
          },
        },
      ]),
      FollowerFollowing.exists({ followerId: userId, followingId: hostId }),
      FollowerFollowing.countDocuments({ followingId: hostId }),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    host.isFollowing = Boolean(isFollowing);
    host.totalFollower = totalFollower || 0;

    return res.status(200).json({
      status: true,
      message: "The host profile retrieved.",
      host,
      receivedGifts,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get host profile ( host )
exports.fetchHostInfo = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const [host] = await Promise.all([
      Host.findOne({ _id: hostId, isBlock: false })
        .select(
          "name email gender dob bio uniqueId countryFlagImage country impression language image photoGallery randomCallRate randomCallFemaleRate randomCallMaleRate privateCallRate audioCallRate chatRate coin"
        )
        .lean(),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    return res.status(200).json({ status: true, message: "The host profile retrieved.", host });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get random free host ( random video call ) ( user )
exports.retrieveAvailableHost = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { gender } = req.query;

    if (!gender || !["male", "female", "both"].includes(gender.trim().toLowerCase())) {
      return res.status(200).json({ status: false, message: "Gender must be one of: male, female, or both." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({ status: false, message: "Valid userId is required." });
    }

    const normalizedGender = gender.trim().toLowerCase();

    const [blockedHosts, lastMatch] = await Promise.all([
      Block.aggregate([{ $match: { userId: new mongoose.Types.ObjectId(userId), blockedBy: "user" } }, { $project: { _id: 0, hostId: 1 } }, { $group: { _id: null, ids: { $addToSet: "$hostId" } } }]),
      HostMatchHistory.findOne({ userId }).lean(),
    ]);

    const blockedHostIds = blockedHosts[0]?.ids || [];
    const lastMatchedHostId = lastMatch?.lastHostId;

    const matchQuery = {
      isOnline: true,
      isBusy: false,
      isFake: false,
      isLive: false,
      isBlock: false,
      status: 2,
      callId: null,
      _id: { $nin: blockedHostIds.map((id) => new mongoose.Types.ObjectId(id)) },
    };

    if (normalizedGender !== "both") {
      matchQuery.gender = normalizedGender;
    }

    const availableHosts = await Host.find(matchQuery).lean();

    // Filter out last matched host if more than one host is available
    let filteredHosts = availableHosts;
    if (availableHosts.length > 1 && lastMatchedHostId) {
      filteredHosts = availableHosts.filter((host) => host._id.toString() !== lastMatchedHostId.toString());
    }

    if (filteredHosts.length === 0) {
      return res.status(200).json({ status: false, message: "No available hosts found!" });
    }

    const matchedHost = filteredHosts[Math.floor(Math.random() * filteredHosts.length)];

    res.status(200).json({
      status: true,
      message: "Matched host retrieved!",
      data: matchedHost,
    });

    await HostMatchHistory.findOneAndUpdate({ userId }, { lastHostId: matchedHost._id }, { upsert: true, new: true });
  } catch (error) {
    console.error("Match Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

//update host's info  ( host )
exports.modifyHostDetails = async (req, res) => {
  try {
    const {
      hostId,
      name,
      bio,
      dob,
      gender,
      countryFlagImage,
      country,
      language,
      impression,
      email,
      randomCallRate,
      randomCallFemaleRate,
      randomCallMaleRate,
      privateCallRate,
      audioCallRate,
      chatRate,
    } = req.body;

    if (!hostId) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Missing or invalid host details. Please check and try again." });
    }

    const [host, existingHost] = await Promise.all([Host.findOne({ _id: hostId }), email ? Host.findOne({ email: email?.trim() }).select("_id").lean() : null]);

    if (!host) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    if (existingHost) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "A host profile with this email already exists." });
    }

    host.name = name || host.name;
    host.email = email || host.email;
    host.bio = bio || host.bio;
    host.dob = dob || host.dob;
    host.gender = gender || host.gender;
    host.countryFlagImage = countryFlagImage || host.countryFlagImage;
    host.country = country || host.country;
    host.countryFlagImage = countryFlagImage || host.countryFlagImage;
    host.impression = typeof impression === "string" ? impression.split(",") : Array.isArray(impression) ? impression : host.impression;
    host.language = typeof language === "string" ? language.split(",") : Array.isArray(language) ? language : host.language;
    host.randomCallRate = randomCallRate || host.randomCallRate;
    host.randomCallFemaleRate = randomCallFemaleRate || host.randomCallFemaleRate;
    host.randomCallMaleRate = randomCallMaleRate || host.randomCallMaleRate;
    host.privateCallRate = privateCallRate || host.privateCallRate;
    host.audioCallRate = audioCallRate || host.audioCallRate;
    host.chatRate = chatRate || host.chatRate;

    if (req.files.image) {
      if (host.image) {
        const imagePath = host.image.includes("storage") ? "storage" + host.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) {
          const imageName = imagePath.split("/").pop();
          if (!["male.png", "female.png"].includes(imageName)) {
            fs.unlinkSync(imagePath);
          }
        }
      }

      host.image = req.files.image[0].path;
    }

    if (req.files.photoGallery) {
      if (host.photoGallery.length > 0) {
        for (const photo of host.photoGallery) {
          const photoGalleryPath = photo?.url?.split("storage");
          if (photoGalleryPath?.[1]) {
            const filePath = "storage" + photoGalleryPath[1];
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (error) {
                console.error(`Error deleting file: ${filePath}`, error);
              }
            }
          }
        }
      }

      let updatedPhotoGallery = req.files.photoGallery.map((file) => ({ url: file.path }));
      host.photoGallery = updatedPhotoGallery;
    }

    await host.save();

    return res.status(200).json({
      status: true,
      message: "Host profile updated successfully.",
      host,
    });
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.error("Update Host Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to Update host profile due to server error.",
    });
  }
};

//get host thumblist ( host )
exports.fetchHostsList = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "hostId is required." });
    }

    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Configuration settings not found." });
    }

    if (!req.query.country) {
      return res.status(200).json({ status: false, message: "Please provide a country name." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);
    const country = req.query.country.trim().toLowerCase();
    const isGlobal = country === "global";

    const fakeMatchQuery = isGlobal ? { isFake: true, isBlock: false, _id: { $ne: hostId } } : { country: country, isFake: true, isBlock: false, _id: { $ne: hostId } };
    const matchQuery = isGlobal ? { isFake: false, isBlock: false, status: 2, _id: { $ne: hostId } } : { country: country, isFake: false, isBlock: false, status: 2, _id: { $ne: hostId } };

    const [fakeHost, host, followerList] = await Promise.all([
      Host.aggregate([
        { $match: fakeMatchQuery },
        {
          $addFields: {
            status: {
              $switch: {
                branches: [
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
                ],
                default: "Offline",
              },
            },
            audioCallRate: 0,
            privateCallRate: 0,
            liveHistoryId: "",
            token: "",
            channel: "",
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            audioCallRate: 1,
            privateCallRate: 1,
            isFake: 1,
            status: 1,
            video: 1,
            liveHistoryId: 1,
            token: 1,
            channel: 1,
          },
        },
      ]),
      Host.aggregate([
        { $match: matchQuery },
        {
          $addFields: {
            status: {
              $switch: {
                branches: [
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
                ],
                default: "Offline",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            audioCallRate: 1,
            privateCallRate: 1,
            isFake: 1,
            status: 1,
          },
        },
      ]),
      FollowerFollowing.find({ followingId: hostId }).populate("followerId", "_id name image uniqueId").sort({ createdAt: -1 }).lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "Hosts list retrieved successfully.",
      hosts: settingJSON.isDemoData ? [...fakeHost, ...host] : host,
      followerList,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching the hosts list.",
      error: error.message || "Internal Server Error",
    });
  }
};
