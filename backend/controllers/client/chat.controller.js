const Chat = require("../../models/chat.model");

//import model
const ChatTopic = require("../../models/chatTopic.model");
const User = require("../../models/user.model");
const Host = require("../../models/host.model");
const History = require("../../models/history.model");

//mongoose
const mongoose = require("mongoose");

//private key
const admin = require("../../util/privateKey");

//deletefile
const { deleteFiles } = require("../../util/deletefile");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//send message ( image or audio ) ( user )
exports.pushChatMessage = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.body.chatTopicId || !req.body.receiverId || !req.body.messageType || !req.files) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const messageType = Number(req.body.messageType);
    const senderId = new mongoose.Types.ObjectId(req.user.userId);
    const receiverId = new mongoose.Types.ObjectId(req.body.receiverId);
    const chatTopicId = new mongoose.Types.ObjectId(req.body.chatTopicId);

    const [uniqueId, sender, receiver, chatTopic] = await Promise.all([
      generateHistoryUniqueId(),
      User.findById(senderId).lean().select("name image coin"),
      Host.findOne({ _id: receiverId, isBlock: false }).lean().select("name image fcmToken chatRate agencyId"),
      ChatTopic.findOne({ _id: chatTopicId }).lean().select("_id chatId messageCount"),
    ]);

    if (!sender) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Sender does not found." });
    }

    if (!receiver) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Receiver dose not found." });
    }

    if (!chatTopic) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "ChatTopic dose not found." });
    }

    const maxFreeChatMessages = settingJSON.maxFreeChatMessages || 10;
    const adminCommissionRate = settingJSON.adminCommissionRate || 10; // 10% commission
    const isWithinFreeLimit = chatTopic.messageCount < maxFreeChatMessages;
    const chatRate = receiver.chatRate || 10;

    let deductedCoins = 0;
    let adminShare = 0;
    let hostEarnings = 0;

    if (!isWithinFreeLimit && sender.coin < chatRate) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Insufficient coins to send message." });
    }

    const chat = new Chat();
    chat.senderId = sender._id;

    if (messageType == 2) {
      chat.messageType = 2;
      chat.message = "📸 Image";
      chat.image = req?.files?.image ? req?.files?.image[0].path : "";
    } else if (messageType == 3) {
      chat.messageType = 3;
      chat.message = "🎤 Audio";
      chat.audio = req?.files?.audio ? req?.files?.audio[0].path : "";
    } else {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "messageType must be passed valid." });
    }

    chat.chatTopicId = chatTopic._id;
    chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    await Promise.all([
      chat.save(),
      ChatTopic.updateOne(
        { _id: chatTopic._id },
        {
          $set: { chatId: chat._id },
          $inc: { messageCount: 1 },
        }
      ),
    ]);

    res.status(200).json({
      status: true,
      message: "Message sent successfully.",
      chat: chat,
    });

    if (!isWithinFreeLimit) {
      deductedCoins = chatRate;
      adminShare = (chatRate * adminCommissionRate) / 100;
      hostEarnings = chatRate - adminShare;

      await Promise.all([
        User.updateOne({ _id: sender._id, coin: { $gte: deductedCoins } }, { $inc: { coin: -deductedCoins, spentCoins: deductedCoins } }),
        Host.updateOne({ _id: receiver._id }, { $inc: { coin: hostEarnings } }),
        History.create({
          uniqueId: uniqueId,
          type: 9,
          userId: senderId,
          hostId: receiverId,
          agencyId: receiver?.agencyId,
          userCoin: chatRate,
          hostCoin: hostEarnings,
          adminCoin: adminShare,
          date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        }),
      ]);
    }

    if (receiver.fcmToken !== null) {
      const payload = {
        token: receiver.fcmToken,
        notification: {
          title: `${sender.name} sent you a message 📩`,
          body: `🗨️ ${chat.message}`,
        },
        data: {
          type: "CHAT",
          senderId: String(chatTopic?.senderId || ""),
          receiverId: String(chatTopic?.receiverId || ""),
          userName: String(sender?.name || ""),
          hostName: String(receiver?.name || ""),
          userImage: String(sender?.image || ""),
          hostImage: String(receiver?.image || ""),
          senderRole: "user",
        },
      };

      const adminPromise = await admin;
      adminPromise
        .messaging()
        .send(payload)
        .then((response) => {
          console.log("Successfully sent with response: ", response);
        })
        .catch((error) => {
          console.error("Error sending FCM message:", error); // Log only
        });
    }
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get old chat ( user )
exports.fetchChatHistory = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.query.receiverId) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const senderId = new mongoose.Types.ObjectId(req.user.userId);
    const receiverId = new mongoose.Types.ObjectId(req.query.receiverId);

    let chatTopic;
    const [receiver, foundChatTopic] = await Promise.all([
      Host.findOne({ _id: receiverId, isBlock: false }).lean().select("_id audioCallRate privateCallRate"),
      ChatTopic.findOne({
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      }).select("_id"),
    ]);

    if (!receiver) {
      return res.status(200).json({ status: false, message: "Receiver not found." });
    }

    chatTopic = foundChatTopic;
    if (!chatTopic) {
      chatTopic = new ChatTopic();
      chatTopic.senderId = senderId;
      chatTopic.receiverId = receiver._id;
    }

    const [savedChatTopic, updatedReadStatus, chatHistory] = await Promise.all([
      chatTopic.save(),
      Chat.updateMany({ chatTopicId: chatTopic._id, isRead: false }, { $set: { isRead: true } }),
      Chat.find({ chatTopicId: chatTopic._id })
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "Chat history retrieved successfully.",
      chatTopic: chatTopic._id,
      chat: chatHistory,
      callRate: {
        privateCallRate: receiver.privateCallRate || 0,
        audioCallRate: receiver.audioCallRate || 0,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//send message ( image or audio ) ( host )
exports.submitChatMessage = async (req, res) => {
  try {
    if (!req.body.senderId || !req.body.chatTopicId || !req.body.receiverId || !req.body.messageType) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const messageType = Number(req.body.messageType);
    const senderId = new mongoose.Types.ObjectId(req.body.senderId);
    const receiverId = new mongoose.Types.ObjectId(req.body.receiverId);
    const chatTopicId = new mongoose.Types.ObjectId(req.body.chatTopicId);

    const [sender, receiver, chatTopic] = await Promise.all([
      Host.findOne({ _id: senderId, isBlock: false }).lean().select("name image"),
      User.findById({ _id: receiverId, isBlock: false }).lean().select("name image fcmToken"),
      ChatTopic.findOne({ _id: chatTopicId }).lean().select("_id chatId"),
    ]);

    if (!sender) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Sender does not found." });
    }

    if (!receiver) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Receiver dose not found." });
    }

    if (!chatTopic) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "ChatTopic dose not found." });
    }

    const chat = new Chat();
    chat.senderId = sender._id;

    if (messageType == 2) {
      chat.messageType = 2;
      chat.message = "📸 Image";
      chat.image = req.files ? req?.files?.image[0].path : "";
    } else if (messageType == 3) {
      chat.messageType = 3;
      chat.message = "🎤 Audio";
      chat.audio = req.files ? req?.files?.audio[0].path : "";
    } else {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "messageType must be passed valid." });
    }

    chat.chatTopicId = chatTopic._id;
    chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    await Promise.all([
      chat.save(),
      ChatTopic.updateOne(
        { _id: chatTopic._id },
        {
          $set: { chatId: chat._id },
        }
      ),
    ]);

    res.status(200).json({
      status: true,
      message: "Message sent successfully.",
      chat: chat,
    });

    if (receiver.fcmToken !== null) {
      const adminPromise = await admin;

      const payload = {
        token: receiver.fcmToken,
        notification: {
          title: `${sender.name} sent you a message 📩`,
          body: `🗨️ ${chat.message}`,
        },
        data: {
          type: "CHAT",
          senderId: String(chatTopic?.senderId || ""),
          receiverId: String(chatTopic?.receiverId || ""),
          userName: String(sender?.name || ""),
          hostName: String(receiver?.name || ""),
          userImage: String(sender?.image || ""),
          hostImage: String(receiver?.image || ""),
          senderRole: "user",
        },
      };

      adminPromise
        .messaging()
        .send(payload)
        .then((response) => {
          console.log("Successfully sent with response: ", response);
        })
        .catch((error) => {
          console.log("Error sending message:      ", error);
        });
    }
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get old chat ( host )
exports.retrieveChatHistory = async (req, res) => {
  try {
    if (!req.query.senderId || !req.query.receiverId) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const senderId = new mongoose.Types.ObjectId(req.query.senderId);
    const receiverId = new mongoose.Types.ObjectId(req.query.receiverId);

    let chatTopic;
    const [receiver, foundChatTopic] = await Promise.all([
      User.findOne({ _id: receiverId, isBlock: false }).lean().select("_id"),
      ChatTopic.findOne({
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      }).select("_id"),
    ]);

    if (!receiver) {
      return res.status(200).json({ status: false, message: "Receiver not found." });
    }

    chatTopic = foundChatTopic;
    if (!chatTopic) {
      chatTopic = new ChatTopic();
      chatTopic.senderId = senderId;
      chatTopic.receiverId = receiver._id;
    }

    const [savedChatTopic, updatedReadStatus, chatHistory] = await Promise.all([
      chatTopic.save(),
      Chat.updateMany({ chatTopicId: chatTopic._id, isRead: false }, { $set: { isRead: true } }),
      Chat.find({ chatTopicId: chatTopic._id })
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "Chat history retrieved successfully.",
      chatTopic: chatTopic._id,
      chat: chatHistory,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
