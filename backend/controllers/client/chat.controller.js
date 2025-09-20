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

// ✅ HARDCODED: Chat settings
const chatSettings = {
  maxFreeChatMessages: 10,
  adminCommissionRate: 10
};

console.log("💬 [CHAT] Using hardcoded chat settings:", chatSettings);

//send message ( image or audio ) ( user )
exports.pushChatMessage = async (req, res) => {
  try {
    console.log("📤 [PUSH CHAT] Starting chat message push...");
    console.log("📤 [PUSH CHAT] Request body:", req.body);
    console.log("📤 [PUSH CHAT] Request files:", req.files ? Object.keys(req.files) : "No files");
    console.log("📤 [PUSH CHAT] User from token:", req.user);

    if (!req.user || !req.user.userId) {
      console.log("❌ [PUSH CHAT] Unauthorized access - no user ID");
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.body.chatTopicId || !req.body.receiverId || !req.body.messageType || !req.files) {
      console.log("❌ [PUSH CHAT] Missing required fields:", {
        chatTopicId: !!req.body.chatTopicId,
        receiverId: !!req.body.receiverId,
        messageType: !!req.body.messageType,
        files: !!req.files
      });
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const messageType = Number(req.body.messageType);
    const senderId = new mongoose.Types.ObjectId(req.user.userId);
    const receiverId = new mongoose.Types.ObjectId(req.body.receiverId);
    const chatTopicId = new mongoose.Types.ObjectId(req.body.chatTopicId);

    console.log("📤 [PUSH CHAT] Parsed data:", {
      messageType,
      senderId: senderId.toString(),
      receiverId: receiverId.toString(),
      chatTopicId: chatTopicId.toString()
    });

    const [uniqueId, sender, receiver, chatTopic] = await Promise.all([
      generateHistoryUniqueId(),
      User.findById(senderId).lean().select("name image coin"),
      Host.findOne({ _id: receiverId, isBlock: false }).lean().select("name image fcmToken chatRate agencyId"),
      ChatTopic.findOne({ _id: chatTopicId }).lean().select("_id chatId messageCount"),
    ]);

    console.log("📤 [PUSH CHAT] Database results:", {
      uniqueId,
      sender: sender ? { _id: sender._id, name: sender.name, coin: sender.coin } : null,
      receiver: receiver ? { _id: receiver._id, name: receiver.name, chatRate: receiver.chatRate } : null,
      chatTopic: chatTopic ? { _id: chatTopic._id, messageCount: chatTopic.messageCount } : null
    });

    if (!sender) {
      console.log("❌ [PUSH CHAT] Sender not found");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Sender does not found." });
    }

    if (!receiver) {
      console.log("❌ [PUSH CHAT] Receiver not found or blocked");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Receiver dose not found." });
    }

    if (!chatTopic) {
      console.log("❌ [PUSH CHAT] Chat topic not found");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "ChatTopic dose not found." });
    }

    // ✅ Use hardcoded settings instead of settingJSON
    const maxFreeChatMessages = chatSettings.maxFreeChatMessages;
    const adminCommissionRate = chatSettings.adminCommissionRate;
    const isWithinFreeLimit = chatTopic.messageCount < maxFreeChatMessages;
    const chatRate = receiver.chatRate || 10;

    console.log("💰 [PUSH CHAT] Chat economics:", {
      messageCount: chatTopic.messageCount,
      maxFreeChatMessages,
      isWithinFreeLimit,
      chatRate,
      senderCoins: sender.coin,
      adminCommissionRate
    });

    let deductedCoins = 0;
    let adminShare = 0;
    let hostEarnings = 0;

    if (!isWithinFreeLimit && sender.coin < chatRate) {
      console.log("❌ [PUSH CHAT] Insufficient coins");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Insufficient coins to send message." });
    }

    const chat = new Chat();
    chat.senderId = sender._id;

    if (messageType == 2) {
      chat.messageType = 2;
      chat.message = "📸 Image";
      chat.image = req?.files?.image ? req?.files?.image[0].path : "";
      console.log("📤 [PUSH CHAT] Image message:", { imagePath: chat.image });
    } else if (messageType == 3) {
      chat.messageType = 3;
      chat.message = "🎤 Audio";
      chat.audio = req?.files?.audio ? req?.files?.audio[0].path : "";
      console.log("📤 [PUSH CHAT] Audio message:", { audioPath: chat.audio });
    } else {
      console.log("❌ [PUSH CHAT] Invalid message type:", messageType);
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "messageType must be passed valid." });
    }

    chat.chatTopicId = chatTopic._id;
    chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    console.log("💾 [PUSH CHAT] About to save chat:", {
      messageType: chat.messageType,
      senderId: chat.senderId,
      chatTopicId: chat.chatTopicId,
      message: chat.message,
      date: chat.date
    });

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

    console.log("✅ [PUSH CHAT] Chat saved successfully:", chat._id);

    res.status(200).json({
      status: true,
      message: "Message sent successfully.",
      chat: chat,
    });

    console.log("📤 [PUSH CHAT] Response sent to client");

    // Handle coin deduction if not within free limit
    if (!isWithinFreeLimit) {
      console.log("💰 [PUSH CHAT] Processing coin deduction...");
      
      deductedCoins = chatRate;
      adminShare = (chatRate * adminCommissionRate) / 100;
      hostEarnings = chatRate - adminShare;

      console.log("💰 [PUSH CHAT] Coin calculation:", {
        deductedCoins,
        adminShare,
        hostEarnings
      });

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

      console.log("✅ [PUSH CHAT] Coin deduction completed");
    } else {
      console.log("🆓 [PUSH CHAT] Message sent within free limit, no coins deducted");
    }

    // Send FCM notification
    if (receiver.fcmToken !== null) {
      console.log("📱 [PUSH CHAT] Sending FCM notification to:", receiver.fcmToken.substring(0, 10) + "...");
      
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
          console.log("✅ [PUSH CHAT] FCM notification sent successfully:", response);
        })
        .catch((error) => {
          console.error("❌ [PUSH CHAT] FCM notification failed:", error);
        });
    } else {
      console.log("📱 [PUSH CHAT] No FCM token available for receiver");
    }

  } catch (error) {
    console.error("❌ [PUSH CHAT] Error in pushChatMessage:", error);
    if (req.files) deleteFiles(req.files);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get old chat ( user )
exports.fetchChatHistory = async (req, res) => {
  try {
    console.log("📥 [FETCH CHAT] Starting chat history fetch...");
    console.log("📥 [FETCH CHAT] Query params:", req.query);
    console.log("📥 [FETCH CHAT] User from token:", req.user);

    if (!req.user || !req.user.userId) {
      console.log("❌ [FETCH CHAT] Unauthorized access");
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.query.receiverId) {
      console.log("❌ [FETCH CHAT] Missing receiverId");
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const senderId = new mongoose.Types.ObjectId(req.user.userId);
    const receiverId = new mongoose.Types.ObjectId(req.query.receiverId);

    console.log("📥 [FETCH CHAT] Parsed params:", {
      start,
      limit,
      senderId: senderId.toString(),
      receiverId: receiverId.toString()
    });

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

    console.log("📥 [FETCH CHAT] Database results:", {
      receiver: receiver ? { _id: receiver._id, audioCallRate: receiver.audioCallRate, privateCallRate: receiver.privateCallRate } : null,
      foundChatTopic: foundChatTopic ? foundChatTopic._id : null
    });

    if (!receiver) {
      console.log("❌ [FETCH CHAT] Receiver not found");
      return res.status(200).json({ status: false, message: "Receiver not found." });
    }

    chatTopic = foundChatTopic;
    if (!chatTopic) {
      console.log("📥 [FETCH CHAT] Creating new chat topic");
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

    console.log("📥 [FETCH CHAT] Final results:", {
      savedChatTopic: savedChatTopic._id,
      updatedReadCount: updatedReadStatus.modifiedCount,
      chatHistoryCount: chatHistory.length
    });

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
    console.error("❌ [FETCH CHAT] Error:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//send message ( image or audio ) ( host )
exports.submitChatMessage = async (req, res) => {
  try {
    console.log("📤 [SUBMIT CHAT] Starting host chat message submission...");
    console.log("📤 [SUBMIT CHAT] Request body:", req.body);
    console.log("📤 [SUBMIT CHAT] Request files:", req.files ? Object.keys(req.files) : "No files");

    if (!req.body.senderId || !req.body.chatTopicId || !req.body.receiverId || !req.body.messageType) {
      console.log("❌ [SUBMIT CHAT] Missing required fields:", {
        senderId: !!req.body.senderId,
        chatTopicId: !!req.body.chatTopicId,
        receiverId: !!req.body.receiverId,
        messageType: !!req.body.messageType
      });
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const messageType = Number(req.body.messageType);
    const senderId = new mongoose.Types.ObjectId(req.body.senderId);
    const receiverId = new mongoose.Types.ObjectId(req.body.receiverId);
    const chatTopicId = new mongoose.Types.ObjectId(req.body.chatTopicId);

    console.log("📤 [SUBMIT CHAT] Parsed data:", {
      messageType,
      senderId: senderId.toString(),
      receiverId: receiverId.toString(),
      chatTopicId: chatTopicId.toString()
    });

    const [sender, receiver, chatTopic] = await Promise.all([
      Host.findOne({ _id: senderId, isBlock: false }).lean().select("name image"),
      User.findById({ _id: receiverId, isBlock: false }).lean().select("name image fcmToken"),
      ChatTopic.findOne({ _id: chatTopicId }).lean().select("_id chatId"),
    ]);

    console.log("📤 [SUBMIT CHAT] Database results:", {
      sender: sender ? { _id: sender._id, name: sender.name } : null,
      receiver: receiver ? { _id: receiver._id, name: receiver.name, hasFcmToken: !!receiver.fcmToken } : null,
      chatTopic: chatTopic ? chatTopic._id : null
    });

    if (!sender) {
      console.log("❌ [SUBMIT CHAT] Sender not found");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Sender does not found." });
    }

    if (!receiver) {
      console.log("❌ [SUBMIT CHAT] Receiver not found");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Receiver dose not found." });
    }

    if (!chatTopic) {
      console.log("❌ [SUBMIT CHAT] Chat topic not found");
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "ChatTopic dose not found." });
    }

    const chat = new Chat();
    chat.senderId = sender._id;

    if (messageType == 2) {
      chat.messageType = 2;
      chat.message = "📸 Image";
      chat.image = req.files ? req?.files?.image[0].path : "";
      console.log("📤 [SUBMIT CHAT] Image message:", { imagePath: chat.image });
    } else if (messageType == 3) {
      chat.messageType = 3;
      chat.message = "🎤 Audio";
      chat.audio = req.files ? req?.files?.audio[0].path : "";
      console.log("📤 [SUBMIT CHAT] Audio message:", { audioPath: chat.audio });
    } else {
      console.log("❌ [SUBMIT CHAT] Invalid message type:", messageType);
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "messageType must be passed valid." });
    }

    chat.chatTopicId = chatTopic._id;
    chat.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    console.log("💾 [SUBMIT CHAT] About to save chat:", {
      messageType: chat.messageType,
      senderId: chat.senderId,
      chatTopicId: chat.chatTopicId,
      message: chat.message,
      date: chat.date
    });

    await Promise.all([
      chat.save(),
      ChatTopic.updateOne(
        { _id: chatTopic._id },
        {
          $set: { chatId: chat._id },
        }
      ),
    ]);

    console.log("✅ [SUBMIT CHAT] Chat saved successfully:", chat._id);

    res.status(200).json({
      status: true,
      message: "Message sent successfully.",
      chat: chat,
    });

    console.log("📤 [SUBMIT CHAT] Response sent to client");

    // Send FCM notification
    if (receiver.fcmToken !== null) {
      console.log("📱 [SUBMIT CHAT] Sending FCM notification to:", receiver.fcmToken.substring(0, 10) + "...");
      
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
          senderRole: "host",
        },
      };

      adminPromise
        .messaging()
        .send(payload)
        .then((response) => {
          console.log("✅ [SUBMIT CHAT] FCM notification sent successfully:", response);
        })
        .catch((error) => {
          console.error("❌ [SUBMIT CHAT] FCM notification failed:", error);
        });
    } else {
      console.log("📱 [SUBMIT CHAT] No FCM token available for receiver");
    }
  } catch (error) {
    console.error("❌ [SUBMIT CHAT] Error in submitChatMessage:", error);
    if (req.files) deleteFiles(req.files);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get old chat ( host )
exports.retrieveChatHistory = async (req, res) => {
  try {
    console.log("📥 [RETRIEVE CHAT] Starting host chat history retrieval...");
    console.log("📥 [RETRIEVE CHAT] Query params:", req.query);

    if (!req.query.senderId || !req.query.receiverId) {
      console.log("❌ [RETRIEVE CHAT] Missing required query params");
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const senderId = new mongoose.Types.ObjectId(req.query.senderId);
    const receiverId = new mongoose.Types.ObjectId(req.query.receiverId);

    console.log("📥 [RETRIEVE CHAT] Parsed params:", {
      start,
      limit,
      senderId: senderId.toString(),
      receiverId: receiverId.toString()
    });

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

    console.log("📥 [RETRIEVE CHAT] Database results:", {
      receiver: receiver ? receiver._id : null,
      foundChatTopic: foundChatTopic ? foundChatTopic._id : null
    });

    if (!receiver) {
      console.log("❌ [RETRIEVE CHAT] Receiver not found");
      return res.status(200).json({ status: false, message: "Receiver not found." });
    }

    chatTopic = foundChatTopic;
    if (!chatTopic) {
      console.log("📥 [RETRIEVE CHAT] Creating new chat topic");
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

    console.log("📥 [RETRIEVE CHAT] Final results:", {
      savedChatTopic: savedChatTopic._id,
      updatedReadCount: updatedReadStatus.modifiedCount,
      chatHistoryCount: chatHistory.length
    });

    return res.status(200).json({
      status: true,
      message: "Chat history retrieved successfully.",
      chatTopic: chatTopic._id,
      chat: chatHistory,
    });
  } catch (error) {
    console.error("❌ [RETRIEVE CHAT] Error:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

