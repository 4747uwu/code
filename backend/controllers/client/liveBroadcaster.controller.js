const LiveBroadcaster = require("../../models/liveBroadcaster.model");

//import model
const Host = require("../../models/host.model");
const LiveBroadcastHistory = require("../../models/liveBroadcastHistory.model");
const FollowerFollowing = require("../../models/followerFollowing.model");
const User = require("../../models/user.model");

//private key
const admin = require("../../util/privateKey");

//moment
const moment = require("moment-timezone");

//mongoose
const mongoose = require("mongoose");

//RtcTokenBuilder
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

//live host
exports.HostStreaming = async (req, res) => {
  try {
    const { hostId, channel, agoraUID } = req.query;

    if (!hostId || !channel || !agoraUID) {
      return res.status(200).json({ status: false, message: "Invalid request parameters." });
    }

    // ✅ HARDCODED: Agora settings instead of using settingJSON
    const agoraSettings = {
      agoraAppId: "3b4fe627b863435eaa54175cd133eeba",
      agoraAppCertificate: "4988588782c64770b4ab32ca6bae215b",
      adminCommissionRate: 10,
    };

    console.log("🎬 [LIVE] Using hardcoded Agora settings:", {
      appId: agoraSettings.agoraAppId,
      certificate: agoraSettings.agoraAppCertificate.substring(0, 8) + "...",
      commission: agoraSettings.adminCommissionRate,
    });

    const hostObjectId = new mongoose.Types.ObjectId(hostId);

    const role = RtcRole.PUBLISHER;
    const uid = 0;
    const expirationTimeInSeconds = 24 * 3600;
    const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expirationTimeInSeconds;

    console.log("🔑 [LIVE] Generating Agora token:", {
      hostId: hostObjectId,
      channel: channel,
      agoraUID: agoraUID,
      role: role,
      expirationHours: 24,
    });

    const [host, token] = await Promise.all([
      Host.findById(hostObjectId).select("userId name gender image countryFlagImage country isFake isBlock").lean(),
      RtcTokenBuilder.buildTokenWithUid(
        agoraSettings.agoraAppId,
        agoraSettings.agoraAppCertificate,
        channel,
        uid,
        role,
        privilegeExpiredTs
      ),
      LiveBroadcaster.deleteOne({ hostId: hostObjectId }),
    ]);

    if (!host) {
      console.log("❌ [LIVE] Host not found:", hostObjectId);
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    if (host.isBlock) {
      console.log("❌ [LIVE] Host is blocked:", hostObjectId);
      return res.status(200).json({ status: false, message: "You are blocked by the admin." });
    }

    console.log("✅ [LIVE] Host found and validated:", {
      hostId: host._id,
      name: host.name,
      country: host.country,
      isFake: host.isFake,
      isBlock: host.isBlock,
    });

    const liveHistory = new LiveBroadcastHistory({
      hostId: host._id,
      startTime: moment().tz("Asia/Kolkata").format(),
    });

    const liveBroadcaster = new LiveBroadcaster({
      liveHistoryId: liveHistory._id,
      hostId: host._id,
      userId: host.userId,
      name: host.name,
      gender: host.gender,
      image: host.image,
      countryFlagImage: host.countryFlagImage,
      country: host.country,
      isFake: host.isFake,
      agoraUid: agoraUID,
      channel: channel,
      token: token,
    });

    await Promise.all([
      liveHistory.save(),
      liveBroadcaster.save(),
      Host.updateOne(
        { _id: hostObjectId },
        {
          $set: {
            isBusy: true,
            isLive: true,
            liveHistoryId: liveHistory._id,
            agoraUid: agoraUID,
            channel: channel,
            token: token,
          },
        }
      ),
    ]);

    console.log("🎬 [LIVE] Live broadcast started successfully:", {
      liveHistoryId: liveHistory._id,
      hostId: host._id,
      channel: channel,
      agoraUID: agoraUID,
      tokenGenerated: !!token,
    });

    res.status(200).json({
      status: true,
      message: "Live started successfully by the host.",
      data: liveBroadcaster,
    });

    // ✅ Send notifications to followers
    console.log("📢 [LIVE] Checking for followers to notify...");
    const followers = await FollowerFollowing.find({ followingId: hostObjectId }).distinct("followerId");

    if (followers.length > 0) {
      console.log(`📢 [LIVE] Found ${followers.length} followers`);

      const followerTokens = await User.find({
        _id: { $in: followers },
        isBlock: false,
        fcmToken: { $ne: null },
      }).distinct("fcmToken");

      if (followerTokens.length === 0) {
        console.log("📢 [LIVE] No valid FCM tokens found.");
      } else {
        console.log(`📢 [LIVE] Sending notifications to ${followerTokens.length} followers`);

        const titleOptions = [
          "🌟 Your favorite host just went live!",
          "🚨 A live session is happening now!",
          "🎬 Go live with the host now!",
          "🔥 Don't miss this live show!",
        ];
        const bodyOptions = [
          "🎉 Jump into the action and support your host live!",
          "💬 Interact and enjoy the moment. Live now!",
          "📺 It's showtime! Watch your host live!",
          "✨ Be part of the live journey. Join now!",
        ];

        const title = titleOptions[Math.floor(Math.random() * titleOptions.length)];
        const body = bodyOptions[Math.floor(Math.random() * bodyOptions.length)];

        const payload = {
          tokens: followerTokens,
          notification: { title, body },
          data: {
            type: "LIVE",
            hostId: host._id.toString(),
            liveHistoryId: liveHistory._id.toString(),
            name: host.name.toString(),
            image: host.image.toString(),
            agoraUid: agoraUID.toString(),
            channel: channel.toString(),
            token: token.toString(),
          },
        };

        const firebaseApp = await admin;
        firebaseApp
          .messaging()
          .sendEachForMulticast(payload)
          .then((response) => {
            console.log(`✅ [LIVE] Notification sent: ${response.successCount} successes, ${response.failureCount} failures`);
            if (response.failureCount > 0) {
              response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                  console.error(`❌ [LIVE] Token ${followerTokens[idx]} failed:`, resp.error.message);
                }
              });
            }
          })
          .catch((error) => {
            console.error("❌ [LIVE] FCM Error:", error);
          });
      }
    } else {
      console.log("📢 [LIVE] No followers found for this host");
    }
  } catch (error) {
    console.error("❌ [LIVE] Error in HostStreaming:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
