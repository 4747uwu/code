const Notification = require("../../models/notification.model");

//import model
const User = require("../../models/user.model");
const Host = require("../../models/host.model");

//mongoose
const mongoose = require("mongoose");

//private key
const admin = require("../../util/privateKey");

//sending a notification from admin to a specific user
exports.sendNotificationToSingleUserByAdmin = async (req, res) => {
  try {
    const { userId, title, message } = req.body;

    if (!userId) {
      return res.status(200).json({ status: false, message: "User ID is required." });
    }

    if (!title || !message) {
      return res.status(200).json({ status: false, message: "Both title and message are required." });
    }

    const user = await User.findById(userId).select("_id isBlock fcmToken").lean();
    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    if (user.isBlock) {
      return res.status(403).json({ status: false, message: "This user has been blocked by the admin." });
    }

    if (!user.fcmToken) {
      return res.status(200).json({ status: false, message: "User does not have a valid FCM token." });
    }

    try {
      res.status(200).json({ status: true, message: "Notification sent successfully." });

      const notificationPayload = {
        token: user.fcmToken,
        notification: {
          title: title.trim(),
          body: message.trim(),
          image: req.file ? req.file.path : "",
        },
      };

      const adminInstance = await admin;
      await adminInstance.messaging().send(notificationPayload);
      console.log("Notification sent successfully.");

      await new Notification({
        user: user._id,
        notificationPersonType: 1, // 1 = User
        title: title.trim(),
        message: message.trim(),
        image: req.file ? req.file.path : "",
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }).save();
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ status: false, message: "Failed to send notification." });
    }
  } catch (error) {
    console.error("Error in sendNotificationToSingleUserByAdmin:", error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//sending a notification from admin to a specific host
exports.sendNotificationToSingleHostByAdmin = async (req, res) => {
  try {
    const { hostId, title, message } = req.body;

    if (!hostId) {
      return res.status(200).json({ status: false, message: "Host ID is required." });
    }

    if (!title || !message) {
      return res.status(200).json({ status: false, message: "Both title and message are required." });
    }

    const host = await Host.findById(hostId).select("_id isBlock fcmToken").lean();
    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    if (host.isBlock) {
      return res.status(403).json({ status: false, message: "This host has been blocked by the admin." });
    }

    if (!host.fcmToken) {
      return res.status(200).json({ status: false, message: "Host does not have a valid FCM token." });
    }

    try {
      res.status(200).json({ status: true, message: "Notification sent successfully." });

      const notificationPayload = {
        token: host.fcmToken,
        notification: {
          title: title.trim(),
          body: message.trim(),
          image: req.file ? req.file.path : "",
        },
      };

      const adminInstance = await admin;
      const response = adminInstance.messaging().send(notificationPayload);
      console.log("Notification sent successfully:", response);

      await new Notification({
        host: host._id,
        notificationPersonType: 2, // 2 = Host
        title: title.trim(),
        message: message.trim(),
        image: req.file ? req.file.path : "",
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }).save();
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ status: false, message: "Failed to send notification." });
    }
  } catch (error) {
    console.error("Error in sendNotificationToSingleHostByAdmin:", error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//sending a notification from admin to user/host/both
exports.sendNotifications = async (req, res) => {
  try {
    const { notificationType, title, message } = req.body;
    const image = req.file ? req.file.path : "";
    const date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    let targets = [];

    if (notificationType?.trim().toLowerCase() === "user") {
      targets = await User.find({ isBlock: false }, "_id fcmToken");
    } else if (notificationType?.trim().toLowerCase() === "host") {
      targets = await Host.find({ isBlock: false }, "_id fcmToken");
    } else if (notificationType?.trim().toLowerCase() === "both") {
      const [users, hosts] = await Promise.all([User.find({ isBlock: false }, "_id fcmToken"), Host.find({ isBlock: false }, "_id fcmToken")]);
      targets = [...users.map((u) => ({ ...u.toObject(), isUser: true })), ...hosts.map((h) => ({ ...h.toObject(), isHost: true }))];
    } else {
      return res.status(200).json({ status: false, message: "Please pass a valid notificationType!" });
    }

    const notifications = [];
    const tokens = [];

    await Promise.all(
      targets.map(async (item) => {
        const isUser = item.isUser || (!item.isHost && notificationType === "User");
        const isHost = item.isHost || (!item.isUser && notificationType === "Host");

        notifications.push({
          ...(isUser ? { user: item._id, notificationPersonType: 1 } : {}),
          ...(isHost ? { host: item._id, notificationPersonType: 2 } : {}),
          title,
          message,
          image,
          date,
        });

        if (item.fcmToken && typeof item.fcmToken === "string" && item.fcmToken.trim()) {
          tokens.push(item.fcmToken);
        }
      })
    );

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }

    if (tokens.length > 0) {
      const adminInstance = await admin;
      const response = await adminInstance.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: title || "Default Title",
          body: message || "Default Message",
          image,
        },
      });

      console.log("Notification sent:", response);

      if (response.failureCount > 0) {
        response.responses.forEach((res, idx) => {
          if (!res.success) {
            console.error(`Failed token ${tokens[idx]}: ${res.error.message}`);
          }
        });
      }
    } else {
      console.warn("No valid FCM tokens to send.");
    }

    return res.status(200).json({ status: true, message: "Notifications sent successfully." });
  } catch (error) {
    console.error("sendNotifications error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
