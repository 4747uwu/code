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
    console.log("🎭 [HOST REQUEST] Starting host request...");
    console.log("🎭 [HOST REQUEST] Request body:", req.body);
    console.log("🎭 [HOST REQUEST] Request files:", req.files ? Object.keys(req.files) : "No files");

    if (!req.user || !req.user.userId) {
      console.log("❌ [HOST REQUEST] Unauthorized access");
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    console.log("🎭 [HOST REQUEST] User ID:", userId);

    const { email, fcmToken, name, bio, dob, gender, countryFlagImage, country, language, impression, agencyCode, identityProofType } = req.body;

    // Validate required fields
    if (!email || !fcmToken || !name || !bio || !dob || !gender || !countryFlagImage || !country || !impression || !language || !identityProofType || !req.files) {
      console.log("❌ [HOST REQUEST] Missing required fields:", {
        email: !!email,
        fcmToken: !!fcmToken,
        name: !!name,
        bio: !!bio,
        dob: !!dob,
        gender: !!gender,
        countryFlagImage: !!countryFlagImage,
        country: !!country,
        impression: !!impression,
        language: !!language,
        identityProofType: !!identityProofType,
        files: !!req.files
      });
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    // Validate file uploads
    if (!req.files.identityProof) {
      console.log("❌ [HOST REQUEST] Missing identity proof files");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Identity proof is missing. Please upload a valid file." });
    }

    if (!req.files.photoGallery) {
      console.log("❌ [HOST REQUEST] Missing photo gallery files");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Photo gallery is missing. Please upload the required photos." });
    }

    // if (!req.files.image) {
    //   console.log("❌ [HOST REQUEST] Missing profile image");
    //   if (req.files) deleteFiles(req.files);
    //   return res.status(200).json({ status: false, message: "Image is missing. Please upload a valid image." });
    // }

    console.log("📁 [HOST REQUEST] File upload details:", {
      image: req.files.image ? {
        count: req.files.image.length,
        paths: req.files.image.map(f => f.path)
      } : null,
      identityProof: req.files.identityProof ? {
        count: req.files.identityProof.length,
        paths: req.files.identityProof.map(f => f.path)
      } : null,
      photoGallery: req.files.photoGallery ? {
        count: req.files.photoGallery.length,
        paths: req.files.photoGallery.map(f => f.path)
      } : null
    });

    console.log("🔍 [HOST REQUEST] Checking existing host requests...");
    const [uniqueId, agencyDetails, existingHost, declineHostRequest] = await Promise.all([
      generateUniqueId(),
      agencyCode ? Agency.findOne({ agencyCode: agencyCode }).select("_id").lean() : null,
      Host.findOne({ status: 1, userId: userId }).select("_id").lean(),
      Host.findOne({ status: 3, userId: userId }).select("_id").lean(),
    ]);

    console.log("🔍 [HOST REQUEST] Database check results:", {
      uniqueId,
      agencyDetails: agencyDetails ? agencyDetails._id : null,
      existingHost: !!existingHost,
      declineHostRequest: !!declineHostRequest
    });

    if (existingHost) {
      console.log("❌ [HOST REQUEST] Host request already exists");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops! A host request already exists under an agency." });
    }

    if (agencyCode && !agencyDetails) {
      console.log("❌ [HOST REQUEST] Invalid agency code:", agencyCode);
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Invalid agency ID." });
    }

    // ✅ DON'T SEND RESPONSE YET - Process the data first

    if (declineHostRequest) {
      console.log("🗑️ [HOST REQUEST] Deleting previous declined request:", declineHostRequest._id);
      await Host.findByIdAndDelete(declineHostRequest._id);
      console.log("✅ [HOST REQUEST] Previous declined request deleted");
    }

    const impressions = typeof impression === "string" ? impression.split(",").map((topic) => topic.trim()) : [];
    const languages = typeof language === "string" ? language.split(",").map((lang) => lang.trim()) : [];

    console.log("🔧 [HOST REQUEST] Processed data:", {
      impressions,
      languages,
      imagePath: req.files.image[0].path,
      identityProofPaths: req.files.identityProof.map(f => f.path),
      photoGalleryPaths: req.files.photoGallery.map(f => f.path)
    });

    console.log("💾 [HOST REQUEST] Creating new host record...");
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
    console.log("✅ [HOST REQUEST] Host record saved successfully:", newHost._id);

    // ✅ NOW send the response
    const responseData = {
      status: true,
      message: "Host request successfully sent.",
      hostId: newHost._id,
      data: {
        uniqueId: newHost.uniqueId,
        status: newHost.status,
        image: newHost.image,
        photoGallery: newHost.photoGallery
      }
    };

    console.log("📤 [HOST REQUEST] Sending response:", responseData);
    res.status(200).json(responseData);

    // Handle background notification
    if (fcmToken && fcmToken !== null) {
      console.log("📱 [HOST REQUEST] Sending push notification...");
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
        console.log("✅ [HOST REQUEST] Notification sent successfully");
      } catch (error) {
        console.error("❌ [HOST REQUEST] Error sending notification:", error);
      }
    }

  } catch (error) {
    console.error("❌ [HOST REQUEST] Error in initiateHostRequest:", error);
    if (req.files) {
      console.log("🗑️ [HOST REQUEST] Deleting uploaded files due to error");
      deleteFiles(req.files);
    }
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
    console.log("🎭 [RETRIEVE HOSTS] ==================== START ====================");
    console.log("🎭 [RETRIEVE HOSTS] Request query:", req.query);
    console.log("🎭 [RETRIEVE HOSTS] Request user:", req.user ? { userId: req.user.userId } : "No user");

    if (!req.user || !req.user.userId) {
      console.log("❌ [RETRIEVE HOSTS] Unauthorized access - no user ID");
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    // ✅ Check if settingJSON exists
    console.log("🔧 [RETRIEVE HOSTS] SettingJSON exists:", !!global.settingJSON);
    console.log("🔧 [RETRIEVE HOSTS] SettingJSON isDemoData:", global.settingJSON ? global.settingJSON.isDemoData : "N/A");

    if (!global.settingJSON) {
      console.log("⚠️ [RETRIEVE HOSTS] No global settingJSON, creating fallback...");
      global.settingJSON = { isDemoData: false }; // Fallback
    }

    if (!req.query.country) {
      console.log("❌ [RETRIEVE HOSTS] Missing country parameter");
      return res.status(200).json({ status: false, message: "Please provide a country name." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const country = req.query.country.trim().toLowerCase();
    const isGlobal = country === "global";

    console.log("🔧 [RETRIEVE HOSTS] Parameters:", { userId, country, isGlobal });

    // ✅ First, let's check what hosts exist in the database
    console.log("🔍 [RETRIEVE HOSTS] Checking database for hosts...");
    const allHostsCount = await Host.countDocuments({});
    const acceptedHostsCount = await Host.countDocuments({ status: 2 });
    const onlineHostsCount = await Host.countDocuments({ status: 2, isOnline: true });
    
    console.log("📊 [RETRIEVE HOSTS] Database stats:", {
      totalHosts: allHostsCount,
      acceptedHosts: acceptedHostsCount,
      onlineHosts: onlineHostsCount
    });

    if (allHostsCount === 0) {
      console.log("⚠️ [RETRIEVE HOSTS] No hosts found in database at all!");
      return res.status(200).json({
        status: true,
        message: "No hosts available.",
        followedHost: [],
        liveHost: [],
        hosts: [],
        debug: {
          totalHosts: 0,
          reason: "No hosts in database"
        }
      });
    }

    // ✅ Get sample hosts for debugging
    const sampleHosts = await Host.find({}).limit(3).select("name status country isOnline isBusy isLive isFake isBlock").lean();
    console.log("📝 [RETRIEVE HOSTS] Sample hosts:", sampleHosts);

    // ✅ Simplified query building with logging
    const baseMatchQuery = {
      isFake: false,
      isBlock: false,
      status: 2,
      userId: { $ne: userId }
    };

    const fakeMatchQuery = {
      isFake: true,
      isBlock: false,
      userId: { $ne: userId }
    };

    if (!isGlobal) {
      baseMatchQuery.country = country;
      fakeMatchQuery.country = country;
    }

    console.log("🔍 [RETRIEVE HOSTS] Match queries:", {
      baseMatchQuery,
      fakeMatchQuery
    });

    // ✅ Test simple query first
    console.log("🔍 [RETRIEVE HOSTS] Testing simple host query...");
    const simpleHosts = await Host.find(baseMatchQuery).limit(5).select("name image country status isOnline").lean();
    console.log("📝 [RETRIEVE HOSTS] Simple query results:", simpleHosts.length, simpleHosts);

    if (simpleHosts.length === 0) {
      console.log("⚠️ [RETRIEVE HOSTS] No hosts match the base criteria");
      
      // Debug: Check what's wrong
      const debugQuery1 = await Host.find({ isFake: false }).limit(3).select("name status country").lean();
      const debugQuery2 = await Host.find({ isBlock: false }).limit(3).select("name isBlock").lean();
      const debugQuery3 = await Host.find({ status: 2 }).limit(3).select("name status").lean();
      
      console.log("🔍 [RETRIEVE HOSTS] Debug - Not fake hosts:", debugQuery1.length);
      console.log("🔍 [RETRIEVE HOSTS] Debug - Not blocked hosts:", debugQuery2.length);
      console.log("🔍 [RETRIEVE HOSTS] Debug - Accepted hosts:", debugQuery3.length);

      return res.status(200).json({
        status: true,
        message: "No hosts match your criteria.",
        followedHost: [],
        liveHost: [],
        hosts: [],
        debug: {
          totalHosts: allHostsCount,
          baseMatchQuery,
          notFakeHosts: debugQuery1.length,
          notBlockedHosts: debugQuery2.length,
          acceptedHosts: debugQuery3.length
        }
      });
    }

    // ✅ Run the aggregation pipelines with error handling
    console.log("🔄 [RETRIEVE HOSTS] Running aggregation pipelines...");

    let fakeHost = [];
    let host = [];
    let followedHost = [];
    let liveHost = [];
    let fakeLiveHost = [];

    try {
      console.log("🔄 [RETRIEVE HOSTS] Getting fake hosts...");
      fakeHost = await Host.aggregate([
        { $match: fakeMatchQuery },
        {
          $lookup: {
            from: "blocks",
            let: { hostId: "$_id", userId: userId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] },
                      { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }
                    ],
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
        { $limit: 20 } // ✅ Add limit to prevent overwhelming results
      ]);
      console.log("✅ [RETRIEVE HOSTS] Fake hosts found:", fakeHost.length);
    } catch (error) {
      console.error("❌ [RETRIEVE HOSTS] Error getting fake hosts:", error);
    }

    try {
      console.log("🔄 [RETRIEVE HOSTS] Getting real hosts...");
      host = await Host.aggregate([
        { $match: baseMatchQuery },
        {
          $lookup: {
            from: "blocks",
            let: { hostId: "$_id", userId: userId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] },
                      { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }
                    ],
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
            statusOrder: 1,
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
        { $limit: 50 } // ✅ Add limit
      ]);
      console.log("✅ [RETRIEVE HOSTS] Real hosts found:", host.length);
    } catch (error) {
      console.error("❌ [RETRIEVE HOSTS] Error getting real hosts:", error);
    }

    try {
      console.log("🔄 [RETRIEVE HOSTS] Getting followed hosts...");
      followedHost = await Host.aggregate([
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
                    $or: [
                      { $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] },
                      { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }
                    ],
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
        { $limit: 20 } // ✅ Add limit
      ]);
      console.log("✅ [RETRIEVE HOSTS] Followed hosts found:", followedHost.length);
    } catch (error) {
      console.error("❌ [RETRIEVE HOSTS] Error getting followed hosts:", error);
    }

    // ✅ Get live hosts (simplified for now)
    try {
      console.log("🔄 [RETRIEVE HOSTS] Getting live hosts...");
      const LiveBroadcaster = require("../../models/liveBroadcaster.model");
      liveHost = await LiveBroadcaster.find({
        userId: { $ne: userId }
      }).limit(10).lean();
      console.log("✅ [RETRIEVE HOSTS] Live hosts found:", liveHost.length);
    } catch (error) {
      console.error("❌ [RETRIEVE HOSTS] Error getting live hosts:", error);
    }

    // ✅ Prepare response
    const isDemoData = global.settingJSON ? global.settingJSON.isDemoData : false;
    
    const finalHosts = isDemoData ? [...fakeHost, ...host] : host;
    const finalLiveHosts = isDemoData ? [...fakeLiveHost, ...liveHost] : liveHost;

    console.log("📊 [RETRIEVE HOSTS] Final results:", {
      followedHost: followedHost.length,
      liveHost: finalLiveHosts.length,
      hosts: finalHosts.length,
      isDemoData
    });

    console.log("🎭 [RETRIEVE HOSTS] ==================== END ====================");

    return res.status(200).json({
      status: true,
      message: "Hosts list retrieved successfully.",
      followedHost,
      liveHost: finalLiveHosts,
      hosts: finalHosts,
      debug: {
        totalInDB: allHostsCount,
        acceptedInDB: acceptedHostsCount,
        baseMatchQuery,
        isDemoData,
        sampleHosts: sampleHosts.slice(0, 2) // First 2 for debugging
      }
    });

  } catch (error) {
    console.error("❌ [RETRIEVE HOSTS] Fatal error:", error);
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
    console.log("🎲 [AVAILABLE HOST] ==================== START ====================");
    console.log("🎲 [AVAILABLE HOST] Request query:", req.query);

    if (!req.user || !req.user.userId) {
      console.log("❌ [AVAILABLE HOST] Unauthorized access");
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { gender } = req.query;

    if (!gender || !["male", "female", "both"].includes(gender.trim().toLowerCase())) {
      console.log("❌ [AVAILABLE HOST] Invalid gender:", gender);
      return res.status(200).json({ status: false, message: "Gender must be one of: male, female, or both." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const normalizedGender = gender.trim().toLowerCase();

    console.log("🔧 [AVAILABLE HOST] Parameters:", { userId, normalizedGender });

    // ✅ Check total hosts first
    const totalHosts = await Host.countDocuments({});
    const acceptedHosts = await Host.countDocuments({ status: 2 });
    const onlineHosts = await Host.countDocuments({ status: 2, isOnline: true });
    const availableHosts = await Host.countDocuments({ 
      status: 2, 
      isOnline: true, 
      isBusy: false 
    });

    console.log("📊 [AVAILABLE HOST] Database stats:", {
      totalHosts,
      acceptedHosts,
      onlineHosts,
      availableHosts
    });

    if (totalHosts === 0) {
      console.log("⚠️ [AVAILABLE HOST] No hosts in database");
      return res.status(200).json({ 
        status: false, 
        message: "No hosts found in database!",
        debug: { totalHosts: 0 }
      });
    }

    // ✅ Get blocked hosts
    const [blockedHosts, lastMatch] = await Promise.all([
      Block.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), blockedBy: "user" } },
        { $project: { _id: 0, hostId: 1 } },
        { $group: { _id: null, ids: { $addToSet: "$hostId" } } }
      ]),
      HostMatchHistory.findOne({ userId }).lean(),
    ]);

    const blockedHostIds = blockedHosts[0]?.ids || [];
    const lastMatchedHostId = lastMatch?.lastHostId;

    console.log("🚫 [AVAILABLE HOST] Blocked hosts:", blockedHostIds.length);
    console.log("🔄 [AVAILABLE HOST] Last matched host:", lastMatchedHostId);

    // ✅ Build match query
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

    console.log("🔍 [AVAILABLE HOST] Match query:", matchQuery);

    // ✅ Test query step by step
    const stepByStepTests = {
      allHosts: await Host.countDocuments({}),
      statusAccepted: await Host.countDocuments({ status: 2 }),
      notBlocked: await Host.countDocuments({ status: 2, isBlock: false }),
      online: await Host.countDocuments({ status: 2, isBlock: false, isOnline: true }),
      notBusy: await Host.countDocuments({ status: 2, isBlock: false, isOnline: true, isBusy: false }),
      notLive: await Host.countDocuments({ status: 2, isBlock: false, isOnline: true, isBusy: false, isLive: false }),
      finalMatch: await Host.countDocuments(matchQuery)
    };

    console.log("📊 [AVAILABLE HOST] Step-by-step filtering:", stepByStepTests);

    const availableHostsList = await Host.find(matchQuery).lean();
    console.log("✅ [AVAILABLE HOST] Available hosts found:", availableHostsList.length);

    if (availableHostsList.length === 0) {
      console.log("⚠️ [AVAILABLE HOST] No available hosts found");
      
      // ✅ Debug: Get some sample hosts to see their status
      const sampleHosts = await Host.find({ status: 2 })
        .limit(5)
        .select("name isOnline isBusy isLive isBlock gender")
        .lean();
      
      console.log("📝 [AVAILABLE HOST] Sample hosts for debugging:", sampleHosts);

      return res.status(200).json({ 
        status: false, 
        message: "No available hosts found!",
        debug: {
          stepByStepTests,
          sampleHosts,
          matchQuery
        }
      });
    }

    // Filter out last matched host if more than one host is available
    let filteredHosts = availableHostsList;
    if (availableHostsList.length > 1 && lastMatchedHostId) {
      filteredHosts = availableHostsList.filter((host) => host._id.toString() !== lastMatchedHostId.toString());
      console.log("🔄 [AVAILABLE HOST] Filtered out last matched host. Remaining:", filteredHosts.length);
    }

    if (filteredHosts.length === 0) {
      console.log("⚠️ [AVAILABLE HOST] All hosts filtered out");
      return res.status(200).json({ status: false, message: "No new hosts available!" });
    }

    const matchedHost = filteredHosts[Math.floor(Math.random() * filteredHosts.length)];
    console.log("🎯 [AVAILABLE HOST] Matched host:", {
      _id: matchedHost._id,
      name: matchedHost.name,
      gender: matchedHost.gender,
      isOnline: matchedHost.isOnline
    });

    console.log("🎲 [AVAILABLE HOST] ==================== END ====================");

    res.status(200).json({
      status: true,
      message: "Matched host retrieved!",
      data: matchedHost,
    });

    // Update match history in background
    await HostMatchHistory.findOneAndUpdate(
      { userId }, 
      { lastHostId: matchedHost._id }, 
      { upsert: true, new: true }
    );

  } catch (error) {
    console.error("❌ [AVAILABLE HOST] Fatal error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
//update host's info  ( host )
exports.modifyHostDetails = async (req, res) => {
  try {
    console.log("🎭 [MODIFY HOST] Starting host modification...");
    console.log("🎭 [MODIFY HOST] Request body:", req.body);
    console.log("🎭 [MODIFY HOST] Request files:", req.files ? Object.keys(req.files) : "No files");

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
      console.log("❌ [MODIFY HOST] Missing hostId");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Missing or invalid host details. Please check and try again." });
    }

    console.log("🔍 [MODIFY HOST] Looking for host:", hostId);
    const [host, existingHost] = await Promise.all([
      Host.findOne({ _id: hostId }),
      email ? Host.findOne({ email: email?.trim(), _id: { $ne: hostId } }).select("_id").lean() : null
    ]);

    if (!host) {
      console.log("❌ [MODIFY HOST] Host not found");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    console.log("🔧 [MODIFY HOST] Current host data:", {
      _id: host._id,
      name: host.name,
      email: host.email,
      image: host.image,
      photoGallery: host.photoGallery ? host.photoGallery.length : 0
    });

    if (existingHost) {
      console.log("❌ [MODIFY HOST] Email already exists for another host");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "A host profile with this email already exists." });
    }

    // ✅ DON'T SEND RESPONSE YET - Process the updates first

    // Update text fields
    host.name = name || host.name;
    host.email = email || host.email;
    host.bio = bio || host.bio;
    host.dob = dob || host.dob;
    host.gender = gender || host.gender;
    host.countryFlagImage = countryFlagImage || host.countryFlagImage;
    host.country = country || host.country;
    host.impression = typeof impression === "string" ? impression.split(",") : Array.isArray(impression) ? impression : host.impression;
    host.language = typeof language === "string" ? language.split(",") : Array.isArray(language) ? language : host.language;
    host.randomCallRate = randomCallRate || host.randomCallRate;
    host.randomCallFemaleRate = randomCallFemaleRate || host.randomCallFemaleRate;
    host.randomCallMaleRate = randomCallMaleRate || host.randomCallMaleRate;
    host.privateCallRate = privateCallRate || host.privateCallRate;
    host.audioCallRate = audioCallRate || host.audioCallRate;
    host.chatRate = chatRate || host.chatRate;

    // Handle profile image update
    if (req.files && req.files.image) {
      console.log("📁 [MODIFY HOST] Processing profile image update...");
      console.log("📁 [MODIFY HOST] New image path:", req.files.image[0].path);
      
      // Delete old image
      if (host.image) {
        console.log("🗑️ [MODIFY HOST] Current image:", host.image);
        const imagePath = host.image.includes("storage") ? "storage" + host.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) {
          const imageName = imagePath.split("/").pop();
          if (!["male.png", "female.png"].includes(imageName)) {
            try {
              fs.unlinkSync(imagePath);
              console.log("✅ [MODIFY HOST] Old image deleted:", imagePath);
            } catch (deleteError) {
              console.error("❌ [MODIFY HOST] Error deleting old image:", deleteError);
            }
          }
        }
      }

      host.image = req.files.image[0].path;
      console.log("📁 [MODIFY HOST] Updated image path:", host.image);
    }

    // Handle photo gallery update
    if (req.files && req.files.photoGallery) {
      console.log("📸 [MODIFY HOST] Processing photo gallery update...");
      console.log("📸 [MODIFY HOST] New gallery count:", req.files.photoGallery.length);
      
      // Delete old gallery images
      if (host.photoGallery && host.photoGallery.length > 0) {
        console.log("🗑️ [MODIFY HOST] Deleting old gallery images...");
        for (const photo of host.photoGallery) {
          const photoPath = typeof photo === 'string' ? photo : photo.url;
          if (photoPath) {
            const photoGalleryPath = photoPath.split("storage");
            if (photoGalleryPath && photoGalleryPath[1]) {
              const filePath = "storage" + photoGalleryPath[1];
              if (fs.existsSync(filePath)) {
                try {
                  fs.unlinkSync(filePath);
                  console.log("✅ [MODIFY HOST] Deleted gallery image:", filePath);
                } catch (error) {
                  console.error("❌ [MODIFY HOST] Error deleting gallery image:", filePath, error);
                }
              }
            }
          }
        }
      }

      let updatedPhotoGallery = req.files.photoGallery.map((file) => ({ url: file.path }));
      host.photoGallery = updatedPhotoGallery;
      console.log("📸 [MODIFY HOST] Updated gallery paths:", updatedPhotoGallery.map(p => p.url));
    }

    console.log("💾 [MODIFY HOST] Saving host to database...");
    await host.save();
    console.log("✅ [MODIFY HOST] Host saved successfully");

    // ✅ NOW send the response
    const responseData = {
      status: true,
      message: "Host profile updated successfully.",
      host: {
        _id: host._id,
        name: host.name,
        email: host.email,
        image: host.image,
        photoGallery: host.photoGallery,
        bio: host.bio,
        gender: host.gender,
        country: host.country
      }
    };

    console.log("📤 [MODIFY HOST] Sending response:", responseData);
    return res.status(200).json(responseData);

  } catch (error) {
    console.error("❌ [MODIFY HOST] Error in modifyHostDetails:", error);
    if (req.files) {
      console.log("🗑️ [MODIFY HOST] Deleting uploaded files due to error");
      deleteFiles(req.files);
    }
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to update host profile due to server error.",
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
