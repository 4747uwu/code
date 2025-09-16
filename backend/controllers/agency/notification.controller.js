const Notification = require("../../models/notification.model");
const Host = require("../../models/host.model");

//private key
const admin = require("../../util/privateKey");

//sending a notification from agency to a specific host
exports.notifyHost = async (req, res) => {
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

//sending a notification from admin to hosts
exports.sendBulkHostNotifications = async (req, res) => {
  try {
    const { title, message } = req.body;
    const image = req.file ? req.file.path : "";
    const date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    let targets = [];
    targets = await Host.find({ isBlock: false }, "_id fcmToken");

    const notifications = [];
    const tokens = [];

    await Promise.all(
      targets.map(async (item) => {
        notifications.push({
          host: item._id,
          notificationPersonType: 2,
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
    console.error("sendBulkHostNotifications error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
