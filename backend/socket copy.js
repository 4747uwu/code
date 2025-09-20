///import model
const Agency = require("./models/agency.model");
const User = require("./models/user.model");
const Host = require("./models/host.model");
const ChatTopic = require("./models/chatTopic.model");
const Chat = require("./models/chat.model");
const History = require("./models/history.model");
const Gift = require("./models/gift.model");
const Privatecall = require("./models/privatecall.model");
const Randomcall = require("./models/randomcall.model");
const LiveBroadcaster = require("./models/liveBroadcaster.model");
const LiveBroadcastView = require("./models/liveBroadcastView.model");
const LiveBroadcastHistory = require("./models/liveBroadcastHistory.model");
const VipPlanPrivilege = require("./models/vipPlanPrivilege.model");
const Block = require("./models/block.model");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("./util/generateHistoryUniqueId");

//private key
const admin = require("./util/privateKey");

//mongoose
const mongoose = require("mongoose");

//moment
const moment = require("moment-timezone");

//agora-access-token
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

// ✅ HARDCODED: Complete settings object
const agoraSettings = {
  agoraAppId: "3b4fe627b863435eaa54175cd133eeba",
  agoraAppCertificate: "4988588782c64770b4ab32ca6bae215b",
  adminCommissionRate: 10,
  maxFreeChatMessages: 10,
};

console.log("🔧 [SOCKET INIT] Hardcoded Agora settings initialized:", {
  appId: agoraSettings.agoraAppId,
  certificate: agoraSettings.agoraAppCertificate.substring(0, 8) + "...",
  adminCommissionRate: agoraSettings.adminCommissionRate,
  maxFreeChatMessages: agoraSettings.maxFreeChatMessages
});

io.on("connection", async (socket) => {
  console.log("✅ [SOCKET] Connection established - Client ID:", socket.id);
  
  const { globalRoom } = socket.handshake.query;
  console.log("🔍 [SOCKET] globalRoom received:", globalRoom);
  
  if (!globalRoom) {
    console.error("❌ [SOCKET] No globalRoom provided in handshake");
    return;
  }

  const id = globalRoom.split(":")[1];
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    console.warn("❌ [SOCKET] Invalid or missing ID from globalRoom:", globalRoom);
    return;
  }

  console.log("✅ [SOCKET] Socket connected with ID:", id);

  if (globalRoom) {
    if (!socket.rooms.has(globalRoom)) {
      socket.join(globalRoom);
      console.log(`✅ [SOCKET] Socket joined room: ${globalRoom}`);
    } else {
      console.log(`ℹ️ [SOCKET] Socket already in room: ${globalRoom}`);
    }

    const user = await User.findById(id).select("_id isOnline").lean();

    if (user) {
      await User.findByIdAndUpdate(user._id, { $set: { isOnline: true } }, { new: true });
      console.log(`👤 [SOCKET] User ${user._id} set to online`);
    } else {
      const host = await Host.findOne({ _id: id, status: 2 }).select("_id isOnline").lean();

      if (host) {
        await Host.findByIdAndUpdate(host._id, { $set: { isOnline: true } }, { new: true });
        console.log(`🎭 [SOCKET] Host ${host._id} set to online`);
      }
    }
  } else {
    console.warn("❌ [SOCKET] Invalid globalRoom format:", globalRoom);
  }

  //chat
  socket.on("chatMessageSent", async (data) => {
    console.log("💬 [CHAT MESSAGE] ==================== START ====================");
    console.log("💬 [CHAT MESSAGE] Raw data received:", data);
    
    const parseData = JSON.parse(data);
    console.log("💬 [CHAT MESSAGE] Parsed data:", parseData);
    console.log("💬 [CHAT MESSAGE] Message details:", {
      messageType: parseData?.messageType,
      senderRole: parseData?.senderRole,
      receiverRole: parseData?.receiverRole,
      message: parseData?.message,
      senderId: parseData?.senderId,
      receiverId: parseData?.receiverId,
      chatTopicId: parseData?.chatTopicId
    });

    let senderPromise, receiverPromise;

    if (parseData?.senderRole === "user") {
      senderPromise = User.findById(parseData?.senderId).lean().select("_id name image coin isVip");
      console.log("💬 [CHAT MESSAGE] Sender is USER");
    } else if (parseData?.senderRole === "host") {
      senderPromise = Host.findById(parseData?.senderId).lean().select("_id name image coin");
      console.log("💬 [CHAT MESSAGE] Sender is HOST");
    }

    if (parseData?.receiverRole === "host") {
      receiverPromise = Host.findById(parseData?.receiverId).lean().select("_id name image fcmToken isBlock coin chatRate agencyId");
      console.log("💬 [CHAT MESSAGE] Receiver is HOST");
    } else if (parseData?.receiverRole === "user") {
      receiverPromise = User.findById(parseData?.receiverId).lean().select("_id name image fcmToken isBlock coin");
      console.log("💬 [CHAT MESSAGE] Receiver is USER");
    }

    const chatTopicPromise = ChatTopic.findById(parseData?.chatTopicId).lean().select("_id senderId receiverId chatId messageCount");

    const [uniqueId, sender, receiver, chatTopic] = await Promise.all([generateHistoryUniqueId(), senderPromise, receiverPromise, chatTopicPromise]);

    console.log("💬 [CHAT MESSAGE] Database results:", {
      uniqueId,
      sender: sender ? { _id: sender._id, name: sender.name, coin: sender.coin, isVip: sender.isVip } : null,
      receiver: receiver ? { _id: receiver._id, name: receiver.name, chatRate: receiver.chatRate, fcmToken: !!receiver.fcmToken } : null,
      chatTopic: chatTopic ? { _id: chatTopic._id, messageCount: chatTopic.messageCount } : null
    });

    if (!chatTopic) {
      console.log("❌ [CHAT MESSAGE] Chat topic not found");
      return;
    }

    if (parseData?.messageType == 1) {
      console.log("💬 [CHAT MESSAGE] Processing TEXT message");
      
      if (parseData.senderRole === "user" && parseData.receiverRole === "host") {
        // ✅ FIXED: Use hardcoded settings
        let maxFreeChatMessages = agoraSettings.maxFreeChatMessages;

        console.log("💰 [CHAT MESSAGE] Using hardcoded maxFreeChatMessages:", maxFreeChatMessages);

        //Check if sender is VIP
        if (sender?.isVip) {
          const vipPrivilege = await VipPlanPrivilege.findOne().select("freeMessages").lean();
          if (vipPrivilege?.freeMessages) {
            maxFreeChatMessages = vipPrivilege.freeMessages;
            console.log("🌟 [CHAT MESSAGE] VIP user detected, updated free messages:", maxFreeChatMessages);
          }
        }

        const isWithinFreeLimit = chatTopic.messageCount < maxFreeChatMessages;
        const chatRate = receiver.chatRate || 10;

        console.log("💰 [CHAT MESSAGE] Chat economics:", {
          messageCount: chatTopic.messageCount,
          maxFreeChatMessages,
          isWithinFreeLimit,
          chatRate,
          senderCoins: sender?.coin
        });

        if (!isWithinFreeLimit && sender?.coin < chatRate) {
          console.log("❌ [CHAT MESSAGE] Insufficient coins, message not sent");
          io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("insufficientCoins", "Insufficient coins to send message.");
          return;
        }
      }

      const chat = new Chat({
        messageType: parseData?.messageType,
        senderId: parseData?.senderId,
        message: parseData?.message,
        image: parseData?.image || "",
        chatTopicId: chatTopic._id,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      });

      console.log("💾 [CHAT MESSAGE] About to save chat:", {
        messageType: chat.messageType,
        senderId: chat.senderId,
        message: chat.message,
        chatTopicId: chat.chatTopicId
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

      console.log("✅ [CHAT MESSAGE] Chat saved successfully:", chat._id);

      const eventData = {
        data,
        messageId: chat._id.toString(),
      };

      io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("chatMessageSent", eventData);
      io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("chatMessageSent", eventData);

      console.log("📤 [CHAT MESSAGE] Events emitted to rooms:", {
        senderRoom: "globalRoom:" + chatTopic?.senderId?.toString(),
        receiverRoom: "globalRoom:" + chatTopic?.receiverId?.toString()
      });

      if (parseData.senderRole === "user" && parseData.receiverRole === "host") {
        // ✅ FIXED: Use hardcoded settings instead of settingJSON
        const maxFreeChatMessages = agoraSettings.maxFreeChatMessages;
        const adminCommissionRate = agoraSettings.adminCommissionRate;
        const isWithinFreeLimit = chatTopic.messageCount < maxFreeChatMessages;
        const chatRate = receiver.chatRate || 10;

        console.log("💰 [CHAT MESSAGE] Coin deduction check:", {
          maxFreeChatMessages,
          adminCommissionRate,
          isWithinFreeLimit,
          chatRate,
          messageCount: chatTopic.messageCount
        });

        let deductedCoins = 0;
        let adminShare = 0;
        let hostEarnings = 0;
        let agencyShare = 0;

        if (!isWithinFreeLimit && sender.coin >= chatRate) {
          console.log("💰 [CHAT MESSAGE] Processing coin deduction...");
          
          deductedCoins = chatRate;
          adminShare = (chatRate * adminCommissionRate) / 100;
          hostEarnings = chatRate - adminShare;

          console.log("💰 [CHAT MESSAGE] Coin calculation:", {
            deductedCoins,
            adminShare,
            hostEarnings
          });

          let agencyUpdate = null;
          if (receiver.agencyId) {
            const agency = await Agency.findById(receiver.agencyId).lean().select("_id commissionType commission");

            if (agency) {
              if (agency.commissionType === 1) {
                // Percentage commission
                agencyShare = (hostEarnings * agency.commission) / 100;
                console.log("🏢 [CHAT MESSAGE] Agency percentage commission:", agencyShare);
              } else {
                // Fixed salary, ignore earnings share
                agencyShare = 0;
                console.log("🏢 [CHAT MESSAGE] Agency fixed salary, no commission");
              }

              agencyUpdate = Agency.updateOne(
                { _id: agency._id },
                {
                  $inc: {
                    hostCoins: hostEarnings,
                    totalEarnings: Math.floor(agencyShare),
                    netAvailableEarnings: Math.floor(agencyShare),
                  },
                }
              );
            }
          }

          await Promise.all([
            User.updateOne(
              { _id: sender._id, coin: { $gte: deductedCoins } },
              {
                $inc: {
                  coin: -deductedCoins,
                  spentCoins: deductedCoins,
                },
              }
            ),
            Host.updateOne({ _id: receiver._id }, { $inc: { coin: hostEarnings } }),
            History.create({
              uniqueId: uniqueId,
              type: 9,
              userId: sender._id,
              hostId: receiver._id,
              agencyId: receiver?.agencyId,
              userCoin: chatRate,
              hostCoin: hostEarnings,
              adminCoin: adminShare,
              agencyCoin: Math.floor(agencyShare),
              date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
            }),
            agencyUpdate,
          ]);

          console.log(`✅ [CHAT MESSAGE] Coins Deducted: ${deductedCoins} | Admin: ${adminShare} | Host Earnings: ${hostEarnings}`);
        } else if (!isWithinFreeLimit) {
          console.log("❌ [CHAT MESSAGE] Insufficient coins for paid message");
        } else {
          console.log("🆓 [CHAT MESSAGE] Free message within limit");
        }
      }

      if (receiver && receiver.fcmToken) {
        console.log("📱 [CHAT MESSAGE] Checking for FCM notification...");
        
        const isBlocked = await Block.findOne({
          $or: [
            { userId: sender._id, hostId: receiver._id },
            { userId: receiver._id, hostId: sender._id },
          ],
        });

        if (!isBlocked) {
          console.log("📱 [CHAT MESSAGE] Sending FCM notification");
          
          const payload = {
            token: receiver.fcmToken,
            notification: {
              title: `${sender?.name} sent you a message 💌`,
              body: `🗨️ ${chat?.message}`,
            },
            data: {
              type: "CHAT",
              senderId: String(chatTopic?.senderId || ""),
              receiverId: String(chatTopic?.receiverId || ""),
              userName: String(sender?.name || ""),
              hostName: String(receiver?.name || ""),
              userImage: String(sender?.image || ""),
              hostImage: String(receiver?.image || ""),
              senderRole: String(parseData?.senderRole) || "",
            },
          };

          try {
            const adminInstance = await admin;
            const response = await adminInstance.messaging().send(payload);
            console.log("✅ [CHAT MESSAGE] FCM notification sent successfully:", response);
          } catch (error) {
            console.log("❌ [CHAT MESSAGE] FCM notification failed:", error);
          }
        } else {
          console.log("🚫 [CHAT MESSAGE] Notification not sent - users are blocked");
        }
      } else {
        console.log("📱 [CHAT MESSAGE] No FCM token available for receiver");
      }
    } else {
      console.log("ℹ️ [CHAT MESSAGE] Other message type received:", parseData?.messageType);

      const eventData = {
        data,
        messageId: parseData?.messageId?.toString() || "",
      };

      io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("chatMessageSent", eventData);
      io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("chatMessageSent", eventData);
    }
    
    console.log("💬 [CHAT MESSAGE] ==================== END ====================");
  });

  socket.on("chatGiftSent", async (data) => {
    console.log("🎁 [CHAT GIFT] ==================== START ====================");
    
    const parseData = JSON.parse(data);
    console.log("🎁 [CHAT GIFT] Parsed data:", parseData);

    let senderPromise, receiverPromise;

    if (parseData?.senderRole === "user") {
      senderPromise = User.findById(parseData?.senderId).lean().select("_id name coin");
    } else if (parseData?.senderRole === "host") {
      senderPromise = Host.findById(parseData?.senderId).lean().select("_id name coin");
    }

    if (parseData?.receiverRole === "host") {
      receiverPromise = Host.findById(parseData?.receiverId).lean().select("_id fcmToken isBlock coin agencyId");
    } else if (parseData?.receiverRole === "user") {
      receiverPromise = User.findById(parseData?.receiverId).lean().select("_id fcmToken isBlock coin");
    }

    const chatTopicPromise = ChatTopic.findById(parseData?.chatTopicId).lean().select("_id senderId receiverId chatId");
    const giftPromise = Gift.findById(parseData?.giftId).lean().select("_id coin image type");

    const [uniqueId, sender, receiver, chatTopic, gift] = await Promise.all([generateHistoryUniqueId(), senderPromise, receiverPromise, chatTopicPromise, giftPromise]);

    console.log("🎁 [CHAT GIFT] Database results:", {
      uniqueId,
      sender: sender ? { _id: sender._id, name: sender.name, coin: sender.coin } : null,
      receiver: receiver ? { _id: receiver._id, fcmToken: !!receiver.fcmToken } : null,
      chatTopic: chatTopic ? chatTopic._id : null,
      gift: gift ? { _id: gift._id, coin: gift.coin, type: gift.type } : null
    });

    if (!chatTopic) {
      console.log("❌ [CHAT GIFT] Chat topic not found");
      return;
    }

    if (!gift) {
      console.log("❌ [CHAT GIFT] Gift not found");
      return;
    }

    const giftPrice = gift?.coin || 0;
    const giftCount = parseData?.giftCount || 1;
    const totalGiftCost = giftPrice * giftCount;
    // ✅ FIXED: Use hardcoded settings instead of settingJSON
    const adminCommissionRate = agoraSettings.adminCommissionRate;

    console.log("🎁 [CHAT GIFT] Gift calculation:", {
      giftPrice,
      giftCount,
      totalGiftCost,
      adminCommissionRate,
      senderCoins: sender?.coin
    });

    if (sender?.coin < totalGiftCost) {
      console.log("❌ [CHAT GIFT] Insufficient coins, gift not sent");
      io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("insufficientCoins", "Insufficient coins to send gift.");
      return;
    }

    const chat = new Chat({
      messageType: 4,
      message: `🎁 ${sender.name} sent a gift`,
      image: gift.image || "",
      senderId: sender._id,
      chatTopicId: chatTopic._id,
      giftCount: giftCount,
      giftType: gift.type,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    });

    console.log("💾 [CHAT GIFT] About to save gift chat:", {
      messageType: chat.messageType,
      senderId: chat.senderId,
      giftCount: chat.giftCount,
      giftType: chat.giftType
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

    console.log("✅ [CHAT GIFT] Gift chat saved successfully:", chat._id);

    const eventData = {
      data,
      messageId: chat._id.toString(),
    };

    io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("chatGiftSent", eventData);
    io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("chatGiftSent", eventData);

    let adminShare = (totalGiftCost * adminCommissionRate) / 100;
    let hostEarnings = totalGiftCost - adminShare;
    let agencyShare = 0;

    console.log("💰 [CHAT GIFT] Financial breakdown:", {
      totalGiftCost,
      adminShare,
      hostEarnings
    });

    let agencyUpdate = null;
    if (receiver.agencyId) {
      const agency = await Agency.findById(receiver.agencyId).lean().select("_id commissionType commission");

      if (agency) {
        if (agency.commissionType === 1) {
          // Percentage commission
          agencyShare = (hostEarnings * agency.commission) / 100;
          console.log("🏢 [CHAT GIFT] Agency percentage commission:", agencyShare);
        } else {
          // Fixed salary, ignore earnings share
          agencyShare = 0;
          console.log("🏢 [CHAT GIFT] Agency fixed salary, no commission");
        }

        agencyUpdate = Agency.updateOne(
          { _id: agency._id },
          {
            $inc: {
              hostCoins: hostEarnings,
              totalEarnings: Math.floor(agencyShare),
              netAvailableEarnings: Math.floor(agencyShare),
            },
          }
        );
      }
    }

    await Promise.all([
      User.updateOne(
        { _id: sender._id, coin: { $gte: totalGiftCost } },
        {
          $inc: {
            coin: -totalGiftCost,
            spentCoins: totalGiftCost,
          },
        }
      ),
      Host.updateOne({ _id: receiver._id }, { $inc: { coin: hostEarnings, totalGifts: 1 } }),
      History.create({
        uniqueId: uniqueId,
        type: 10,
        userId: sender._id,
        hostId: receiver._id,
        agencyId: receiver?.agencyId,
        giftId: gift._id,
        giftCoin: gift.coin || 0,
        giftImage: gift.image || "",
        giftType: gift.type || 1,
        giftCount: giftCount,
        userCoin: totalGiftCost,
        hostCoin: hostEarnings,
        adminCoin: adminShare,
        agencyCoin: Math.floor(agencyShare),
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }),
      agencyUpdate,
    ]);

    console.log(`✅ [CHAT GIFT] Gift Sent | Cost: ${totalGiftCost} | Admin Share: ${adminShare} | Host Earnings: ${hostEarnings}`);

    if (receiver && !receiver.isBlock && receiver.fcmToken) {
      console.log("📱 [CHAT GIFT] Sending FCM notification for gift");
      
      const payload = {
        token: receiver.fcmToken,
        notification: {
          title: `${sender.name} sent you a gift 🎁`,
          body: `💝 You received ${giftCount} gifts worth ${totalGiftCost} coins!`,
        },
        data: {
          type: "GIFT",
          giftCount: giftCount.toString(),
        },
      };

      try {
        const adminInstance = await admin;
        const response = await adminInstance.messaging().send(payload);
        console.log("✅ [CHAT GIFT] FCM notification sent successfully:", response);
      } catch (error) {
        console.log("❌ [CHAT GIFT] FCM notification failed:", error);
      }
    } else {
      console.log("📱 [CHAT GIFT] No FCM notification sent - receiver blocked or no token");
    }
    
    console.log("🎁 [CHAT GIFT] ==================== END ====================");
  });

  socket.on("chatMessageSeen", async (data) => {
    try {
      console.log("👁️ [CHAT SEEN] Processing message seen event");
      
      const parsedData = JSON.parse(data);
      console.log("👁️ [CHAT SEEN] Parsed data:", parsedData);

      const updated = await Chat.findByIdAndUpdate(parsedData.messageId, { $set: { isRead: true } }, { new: true, lean: true, select: "_id isRead" });

      if (!updated) {
        console.log(`❌ [CHAT SEEN] No message found with ID ${parsedData.messageId}`);
      } else {
        console.log(`✅ [CHAT SEEN] Updated isRead to true for message: ${updated._id}`);
      }
    } catch (error) {
      console.error("❌ [CHAT SEEN] Error:", error);
    }
  });

  //private video call
  socket.on("callRinging", async (data) => {
    console.log("📞 [CALL RINGING] ==================== START ====================");
    
    const parsedData = JSON.parse(data);
    console.log("📞 [CALL RINGING] Parsed data:", parsedData);

    const { callerId, receiverId, agoraUID, channel, callType } = parsedData;

    const role = RtcRole.PUBLISHER;
    const uid = agoraUID ? agoraUID : 0;
    const expirationTimeInSeconds = 24 * 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    console.log("🔑 [CALL RINGING] Token generation params:", {
      // ✅ FIXED: Use hardcoded settings
      appId: agoraSettings.agoraAppId,
      certificate: agoraSettings.agoraAppCertificate.substring(0, 8) + "...",
      channel,
      uid,
      role,
      expirationHours: 24
    });

    const [callUniqueId, token, caller, receiver] = await Promise.all([
      generateHistoryUniqueId(),
      // ✅ FIXED: Use hardcoded settings instead of settingJSON
      RtcTokenBuilder.buildTokenWithUid(agoraSettings.agoraAppId, agoraSettings.agoraAppCertificate, channel, uid, role, privilegeExpiredTs),
      User.findById(callerId).select("_id name image isBlock isBusy callId isOnline uniqueId").lean(),
      Host.findById(receiverId).select("_id name image isBlock isBusy callId isOnline uniqueId").lean(),
    ]);

    console.log("📞 [CALL RINGING] Database results:", {
      callUniqueId,
      tokenGenerated: !!token,
      caller: caller ? { _id: caller._id, name: caller.name, isBlock: caller.isBlock, isBusy: caller.isBusy, isOnline: caller.isOnline } : null,
      receiver: receiver ? { _id: receiver._id, name: receiver.name, isBlock: receiver.isBlock, isBusy: receiver.isBusy, isOnline: receiver.isOnline } : null
    });

    if (!caller) {
      console.log("❌ [CALL RINGING] Caller not found");
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", { message: "Caller does not found." });
      return;
    }

    if (caller.isBlock) {
      console.log("❌ [CALL RINGING] Caller is blocked");
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Caller is blocked.",
        isBlock: true,
      });
      return;
    }

    if (caller.isBusy && caller.callId) {
      console.log("❌ [CALL RINGING] Caller is busy");
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Caller is busy with someone else.",
        isBusy: true,
      });
      return;
    }

    if (!receiver) {
      console.log("❌ [CALL RINGING] Receiver not found");
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", { message: "Receiver does not found." });
      return;
    }

    if (receiver.isBlock) {
      console.log("❌ [CALL RINGING] Receiver is blocked");
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Receiver is blocked.",
        isBlock: true,
      });
      return;
    }

    if (!receiver.isOnline) {
      console.log("❌ [CALL RINGING] Receiver is not online");
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Receiver is not online.",
        isOnline: false,
      });
      return;
    }

    if (receiver.isBusy && receiver.callId) {
      console.log("❌ [CALL RINGING] Receiver is busy");
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Receiver is busy with another call.",
        isBusy: true,
      });
      return;
    }

    if (!receiver.isBusy && receiver.callId === null) {
      console.log("🟢 [CALL RINGING] Both parties are free, proceeding with call setup");

      const callHistory = new History();
      callHistory.uniqueId = callUniqueId;

      const [callerVerify, receiverVerify] = await Promise.all([
        User.updateOne(
          {
            _id: caller._id,
            isOnline: true,
            isBusy: false,
            callId: null,
          },
          {
            $set: {
              isBusy: true,
              callId: callHistory._id.toString(),
            },
          }
        ),
        Host.updateOne(
          {
            _id: receiver._id,
            isFake: false,
            isBlock: false,
            isOnline: true,
            isBusy: false,
            isLive: false,
            callId: null,
          },
          {
            $set: {
              isBusy: true,
              callId: callHistory._id.toString(),
            },
          }
        ),
      ]);

      console.log("📞 [CALL RINGING] User status updates:", {
        callerUpdated: callerVerify.modifiedCount > 0,
        receiverUpdated: receiverVerify.modifiedCount > 0
      });

      if (callerVerify.modifiedCount > 0 && receiverVerify.modifiedCount > 0) {
        const dataOfVideoCall = {
          callType: callType,
          callerId: caller._id,
          receiverId: receiver._id,
          callerImage: caller.image,
          callerName: caller.name,
          callerUniqueId: caller.uniqueId,
          receiverName: receiver.name,
          receiverImage: receiver.image,
          receiverUniqueId: receiver.uniqueId,
          callId: callHistory._id,
          callType: callType.trim().toLowerCase(),
          callMode: "private",
          token,
          channel,
        };

        console.log("📞 [CALL RINGING] Emitting call events:", {
          receiverEvent: "callIncoming",
          callerEvent: "callConnected",
          callId: callHistory._id
        });

        io.in("globalRoom:" + receiver._id.toString()).emit("callIncoming", dataOfVideoCall); // Notify receiver
        io.in("globalRoom:" + caller._id.toString()).emit("callConnected", dataOfVideoCall); // Notify caller

        console.log(`✅ [CALL RINGING] Call successfully initiated: ${caller.name} → ${receiver.name}`);

        callHistory.type = callType?.trim()?.toLowerCase() === "audio" ? 11 : callType?.trim()?.toLowerCase() === "video" ? 12 : null;
        callHistory.callType = callType?.trim()?.toLowerCase();
        callHistory.isPrivate = true;
        callHistory.userId = caller._id;
        callHistory.hostId = receiver._id;
        callHistory.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        await Promise.all([
          callHistory.save(),
          Privatecall({
            caller: caller._id,
            receiver: receiver._id,
          }).save(),
        ]);

        console.log("✅ [CALL RINGING] Call history and private call records saved");
      } else {
        console.log("❌ [CALL RINGING] Failed to verify caller or receiver availability");

        io.in("globalRoom:" + caller._id.toString()).emit("callRinging", {
          message: "Call setup failed. One or both users became unavailable.",
          isBusy: true,
        });

        // Update isBusy only for the user who failed verification
        if (callerVerify.modifiedCount > 0) {
          await User.updateOne({ _id: callerId, isBusy: true }, { $set: { isBusy: false, callId: null } });
          console.log(`🔹 [CALL RINGING] Caller verification failed, status reset`);
        }

        if (receiverVerify.modifiedCount > 0) {
          await Host.updateOne({ _id: receiverId, isBusy: true }, { $set: { isBusy: false, callId: null } });
          console.log(`🔹 [CALL RINGING] Receiver verification failed, status reset`);
        }
        return;
      }
    } else {
      console.log("❌ [CALL RINGING] Condition not met - receiver not available");

      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Receiver is unavailable for a call at this moment.",
        isBusy: true,
      });
      return;
    }
    
    console.log("📞 [CALL RINGING] ==================== END ====================");
  });

  socket.on("callResponseHandled", async (data) => {
    try {
      console.log("📞 [CALL RESPONSE] ==================== START ====================");
      
      const parsedData = JSON.parse(data);
      console.log("📞 [CALL RESPONSE] Parsed data:", parsedData);

      const { callerId, receiverId, callId, isAccept, callType, callMode } = parsedData;

      const callerRoom = `globalRoom:${callerId}`;
      const receiverRoom = `globalRoom:${receiverId}`;

      console.log(`📞 [CALL RESPONSE] Fetching data for callId: ${callId}`);

      const [caller, receiver, callHistory] = await Promise.all([
        User.findById(callerId).select("_id name isBusy callId").lean(),
        Host.findById(receiverId).select("_id name isBusy callId").lean(),
        History.findById(callId).select("_id callConnect callEndTime duration"),
      ]);

      console.log("📞 [CALL RESPONSE] Database results:", {
        caller: caller ? { _id: caller._id, name: caller.name, isBusy: caller.isBusy, callId: caller.callId } : null,
        receiver: receiver ? { _id: receiver._id, name: receiver.name, isBusy: receiver.isBusy, callId: receiver.callId } : null,
        callHistory: callHistory ? { _id: callHistory._id, callConnect: callHistory.callConnect } : null
      });

      if (!caller || !receiver || !callHistory) {
        console.error("❌ [CALL RESPONSE] Invalid caller, receiver, or call history");
        return io.to(callerRoom).emit("callResponseHandled", { message: "Invalid call data." });
      }

      console.log(`✅ [CALL RESPONSE] Caller: ${caller.name} | Receiver: ${receiver.name} | Call ID: ${callId} | Accept: ${isAccept}`);

      if (callMode.trim().toLowerCase() === "private") {
        if (!isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📵 [CALL RESPONSE] Call rejected by receiver ${receiver.name}`);

          io.to(callerRoom).emit("callRejected", data);
          io.to(receiverRoom).emit("callRejected", data);

          const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
            User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
            Host.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
            Privatecall.deleteOne({ caller: caller._id, receiver: receiver._id }),
          ]);

          console.log(`🔹 [CALL RESPONSE] Status updates:`, {
            callerUpdate: callerUpdate.modifiedCount,
            receiverUpdate: receiverUpdate.modifiedCount,
            privateCallDeleted: privateCallDeleted.deletedCount
          });

          let chatTopic;
          chatTopic = await ChatTopic.findOne({
            $or: [
              {
                $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
              },
              {
                $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
              },
            ],
          });

          const chat = new Chat();

          if (!chatTopic) {
            console.log("📞 [CALL RESPONSE] Creating new chat topic for rejection");
            chatTopic = new ChatTopic();

            chatTopic.chatId = chat._id;
            chatTopic.senderId = caller._id;
            chatTopic.receiverId = receiver._id;
          }

          chat.chatTopicId = chatTopic._id;
          chat.senderId = callerId;
          chat.messageType = callType.trim().toLowerCase() === "audio" ? 5 : 6;
          chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
          chat.callType = 2; // 2.declined
          chat.callId = callId;
          chat.isRead = true;
          chat.date = new Date().toLocaleString();

          chatTopic.chatId = chat._id;

          callHistory.callConnect = false;
          callHistory.callEndTime = moment().tz("Asia/Kolkata").format();

          const start = moment.tz(callHistory.callStartTime, "Asia/Kolkata");
          const end = moment.tz(callHistory.callEndTime, "Asia/Kolkata");
          callHistory.duration = moment.utc(end.diff(start)).format("HH:mm:ss");

          await Promise.all([chat.save(), chatTopic.save(), callHistory?.save()]);
          console.log("✅ [CALL RESPONSE] Call rejection chat & history saved");
          return;
        }

        if (isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📞 [CALL RESPONSE] Call accepted by receiver ${receiver.name}`);

          const privateCallDelete = await Privatecall.deleteOne({
            caller: new mongoose.Types.ObjectId(caller._id),
            receiver: new mongoose.Types.ObjectId(receiver._id),
          });

          console.log("🗑 [CALL RESPONSE] Private call entry deleted:", privateCallDelete.deletedCount);

          if (privateCallDelete?.deletedCount > 0) {
            console.log("🟢 [CALL RESPONSE] Call accepted, emitting event");

            const [callerSockets, receiverSockets] = await Promise.all([io.in(callerRoom).fetchSockets(), io.in(receiverRoom).fetchSockets()]);

            const callerSocket = callerSockets?.[0];
            const receiverSocket = receiverSockets?.[0];

            if (callerSocket && !callerSocket.rooms.has(callId)) {
              callerSocket.join(callId);
              console.log("📞 [CALL RESPONSE] Caller joined call room");
            }

            if (receiverSocket && !receiverSocket.rooms.has(callId)) {
              receiverSocket.join(callId);
              console.log("📞 [CALL RESPONSE] Receiver joined call room");
            }

            io.to(callId.toString()).emit("callAnswerReceived", data);

            console.log(`📡 [CALL RESPONSE] callAnswerReceived event sent to both parties`);

            let chatTopic;
            chatTopic = await ChatTopic.findOne({
              $or: [
                {
                  $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
                },
                {
                  $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
                },
              ],
            });

            const chat = new Chat();

            if (!chatTopic) {
              console.log("📞 [CALL RESPONSE] Creating new chat topic for acceptance");
              chatTopic = new ChatTopic();

              chatTopic.chatId = chat._id;
              chatTopic.senderId = caller._id;
              chatTopic.receiverId = receiver._id;
            }

            chat.chatTopicId = chatTopic._id;
            chat.senderId = callerId;
            chat.messageType = callType.trim().toLowerCase() === "audio" ? 5 : 6;
            chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
            chat.callType = 1; //1.received
            chat.callId = callId;
            chat.date = new Date().toLocaleString();

            chatTopic.chatId = chat._id;

            await Promise.all([
              chat?.save(),
              chatTopic?.save(),
              User.updateOne({ _id: caller._id }, { $set: { isBusy: true, callId: callId } }),
              Host.updateOne({ _id: receiver._id }, { $set: { isBusy: true, callId: callId } }),
              History.updateOne({ _id: callHistory._id }, { $set: { callConnect: true, callStartTime: moment().tz("Asia/Kolkata").format() } }),
            ]);

            console.log("✅ [CALL RESPONSE] Call acceptance processed - users busy, history updated");
          } else {
            console.log(`🚨 [CALL RESPONSE] Call disconnected - private call not found`);

            io.to(receiverRoom).emit("callAutoEnded", data);

            await Promise.all([
              User.updateOne({ _id: caller._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
              Host.updateOne({ _id: receiver._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
            ]);

            console.log("🔹 [CALL RESPONSE] Caller & Receiver status reset");
          }
        }
      }

      if (callMode.trim().toLowerCase() === "random") {
        console.log("🎲 [CALL RESPONSE] Processing random call response");
        
        if (!isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📵 [CALL RESPONSE] Random call rejected by receiver ${receiver.name}`);

          io.to(callerRoom).emit("callRejected", data);
          io.to(receiverRoom).emit("callRejected", data);

          const [callerUpdate, receiverUpdate, randomCallDeleted] = await Promise.all([
            User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
            Host.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
            Randomcall.deleteOne({ caller: caller._id }),
          ]);

          console.log(`🔹 [CALL RESPONSE] Random call status updates:`, {
            callerUpdate: callerUpdate.modifiedCount,
            receiverUpdate: receiverUpdate.modifiedCount,
            randomCallDeleted: randomCallDeleted.deletedCount
          });

          let chatTopic;
          chatTopic = await ChatTopic.findOne({
            $or: [
              {
                $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
              },
              {
                $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
              },
            ],
          });

          const chat = new Chat();

          if (!chatTopic) {
            console.log("📞 [CALL RESPONSE] Creating new chat topic for random call rejection");
            chatTopic = new ChatTopic();

            chatTopic.chatId = chat._id;
            chatTopic.senderId = caller._id;
            chatTopic.receiverId = receiver._id;
          }

          chat.chatTopicId = chatTopic._id;
          chat.senderId = callerId;
          chat.messageType = 6;
          chat.message = "📽 Video Call";
          chat.callType = 2; // 2.declined
          chat.callId = callId;
          chat.isRead = true;
          chat.date = new Date().toLocaleString();

          chatTopic.chatId = chat._id;

          callHistory.callConnect = false;
          callHistory.callEndTime = moment().tz("Asia/Kolkata").format();

          const start = moment.tz(callHistory.callStartTime, "Asia/Kolkata");
          const end = moment.tz(callHistory.callEndTime, "Asia/Kolkata");
          callHistory.duration = moment.utc(end.diff(start)).format("HH:mm:ss");

          await Promise.all([chat.save(), chatTopic.save(), callHistory?.save()]);
          console.log("✅ [CALL RESPONSE] Random call rejection chat & history saved");
          return;
        }

        if (isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📞 [CALL RESPONSE] Random call accepted by receiver ${receiver.name}`);

          const randomCallDeleted = await Randomcall.deleteOne({
            caller: new mongoose.Types.ObjectId(caller._id),
          });

          console.log("🗑 [CALL RESPONSE] Random call entry deleted:", randomCallDeleted.deletedCount);

          if (randomCallDeleted?.deletedCount > 0) {
            console.log("🟢 [CALL RESPONSE] Random call accepted, emitting event");

            const [callerSockets, receiverSockets] = await Promise.all([io.in(callerRoom).fetchSockets(), io.in(receiverRoom).fetchSockets()]);

            const callerSocket = callerSockets?.[0];
            const receiverSocket = receiverSockets?.[0];

            if (callerSocket && !callerSocket.rooms.has(callId)) {
              callerSocket.join(callId);
              console.log("📞 [CALL RESPONSE] Caller joined random call room");
            }

            if (receiverSocket && !receiverSocket.rooms.has(callId)) {
              receiverSocket.join(callId);
              console.log("📞 [CALL RESPONSE] Receiver joined random call room");
            }

            io.to(callId.toString()).emit("callAnswerReceived", data);

            console.log(`📡 [CALL RESPONSE] Random call callAnswerReceived event sent`);

            let chatTopic;
            chatTopic = await ChatTopic.findOne({
              $or: [
                {
                  $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
                },
                {
                  $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
                },
              ],
            });

            const chat = new Chat();

            if (!chatTopic) {
              console.log("📞 [CALL RESPONSE] Creating new chat topic for random call acceptance");
              chatTopic = new ChatTopic();

              chatTopic.chatId = chat._id;
              chatTopic.senderId = caller._id;
              chatTopic.receiverId = receiver._id;
            }

            chat.chatTopicId = chatTopic._id;
            chat.senderId = callerId;
            chat.messageType = 6;
            chat.message = "📽 Video Call";
            chat.callType = 1; //1.received
            chat.callId = callId;
            chat.date = new Date().toLocaleString();

            chatTopic.chatId = chat._id;

            await Promise.all([
              chat?.save(),
              chatTopic?.save(),
              User.updateOne({ _id: caller._id }, { $set: { isBusy: true, callId: callId } }),
              Host.updateOne({ _id: receiver._id }, { $set: { isBusy: true, callId: callId } }),
              History.updateOne({ _id: callHistory._id }, { $set: { callConnect: true, callStartTime: moment().tz("Asia/Kolkata").format() } }),
            ]);

            console.log("✅ [CALL RESPONSE] Random call acceptance processed");
          } else {
            console.log(`🚨 [CALL RESPONSE] Random call disconnected - call not found`);

            io.to(receiverRoom).emit("callAutoEnded", data);

            await Promise.all([
              User.updateOne({ _id: caller._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
              Host.updateOne({ _id: receiver._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
            ]);

            console.log("🔹 [CALL RESPONSE] Random call - Caller & Receiver status reset");
          }
        }
      }
      
      console.log("📞 [CALL RESPONSE] ==================== END ====================");
    } catch (error) {
      console.error("❌ [CALL RESPONSE] Error:", error);
      io.to(`globalRoom:${socket.id}`).emit("callResponseHandled", { message: "Server error. Please try again." });
    }
  });

  socket.on("callCancelled", async (data) => {
    console.log("📞 [CALL CANCELLED] ==================== START ====================");
    
    const parseData = JSON.parse(data);
    const { callerId, receiverId, callId, callType, callMode } = parseData;
    console.log("📞 [CALL CANCELLED] Parsed data:", parseData);

    console.log(`🔄 [CALL CANCELLED] Fetching call details for callId: ${callId}`);

    const [caller, receiver, callHistory] = await Promise.all([
      User.findById(callerId).select("_id name fcmToken isBlock").lean(),
      Host.findById(receiverId).select("_id name fcmToken isBlock").lean(),
      History.findById(callId).select("_id userId callConnect"),
    ]);

    console.log("📞 [CALL CANCELLED] Database results:", {
      caller: caller ? { _id: caller._id, name: caller.name, fcmToken: !!caller.fcmToken } : null,
      receiver: receiver ? { _id: receiver._id, name: receiver.name, fcmToken: !!receiver.fcmToken } : null,
      callHistory: callHistory ? { _id: callHistory._id, userId: callHistory.userId } : null
    });

    if (!caller || !receiver || !callHistory) {
      console.error("❌ [CALL CANCELLED] Invalid caller, receiver, or call history");
      return io.to(`globalRoom:${callerId}`).emit("callCancelFailed", { message: "Invalid call data." });
    }

    io.to("globalRoom:" + callerId).emit("callFinished", data);
    io.to("globalRoom:" + receiverId).emit("callFinished", data);

    console.log(`✅ [CALL CANCELLED] Caller: ${caller.name} | Receiver: ${receiver.name} | Call ID: ${callId}`);

    if (callMode.trim().toLowerCase() === "private") {
      console.log("📞 [CALL CANCELLED] Processing private call cancellation");
      
      const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
        User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
        Host.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
        Privatecall.deleteOne({ caller: caller._id, receiver: receiver._id }),
      ]);

      console.log(`🔹 [CALL CANCELLED] Private call status updates:`, {
        callerUpdate: callerUpdate.modifiedCount,
        receiverUpdate: receiverUpdate.modifiedCount,
        privateCallDeleted: privateCallDeleted.deletedCount
      });
    }

    if (callMode.trim().toLowerCase() === "random") {
      console.log("📞 [CALL CANCELLED] Processing random call cancellation");
      
      const [callerUpdate, receiverUpdate, randomCallDeleted] = await Promise.all([
        User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
        Host.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
        Randomcall.deleteOne({ caller: caller._id }),
      ]);

      console.log(`🔹 [CALL CANCELLED] Random call status updates:`, {
        callerUpdate: callerUpdate.modifiedCount,
        receiverUpdate: receiverUpdate.modifiedCount,
        randomCallDeleted: randomCallDeleted.deletedCount
      });
    }

    callHistory.callConnect = false;

    let chatTopic;
    chatTopic = await ChatTopic.findOne({
      $or: [
        {
          $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
        },
        {
          $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
        },
      ],
    });

    const chat = new Chat();

    if (!chatTopic) {
      console.log("📞 [CALL CANCELLED] Creating new chat topic for cancellation");
      chatTopic = new ChatTopic();

      chatTopic.chatId = chat._id;
      chatTopic.senderId = caller._id;
      chatTopic.receiverId = receiver._id;
      await chatTopic.save();
    }

    chat.chatTopicId = chatTopic._id;
    chat.callId = callHistory?._id;
    chat.senderId = callHistory?.userId;
    chat.messageType = callType.trim().toLowerCase() === "audio" ? 5 : 6;
    chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
    chat.callType = 3; //3.missedCall
    chat.date = new Date().toLocaleString();
    chat.isRead = true;

    chatTopic.chatId = chat._id;

    await Promise.all([chat?.save(), chatTopic?.save(), callHistory?.save()]);

    console.log("✅ [CALL CANCELLED] Chat and call history updated");

    if (!receiver.isBlock && receiver.fcmToken !== null) {
      console.log("📱 [CALL CANCELLED] Sending missed call notification");
      
      const payload = {
        token: receiver.fcmToken,
        notification: {
          title: "📞 Missed Call Alert! ⏳",
          body: "You just missed a call! Tap to reconnect now. 🔄✨",
        },
      };

      const adminPromise = await admin;
      adminPromise
        .messaging()
        .send(payload)
        .then((response) => {
          console.log("✅ [CALL CANCELLED] Missed call notification sent:", response);
        })
        .catch((error) => {
          console.log("❌ [CALL CANCELLED] Missed call notification failed:", error);
        });
    } else {
      console.log("📱 [CALL CANCELLED] No missed call notification sent - receiver blocked or no token");
    }
    
    console.log("📞 [CALL CANCELLED] ==================== END ====================");
  });

  socket.on("callDisconnected", async (data) => {
    console.log("📞 [CALL DISCONNECTED] ==================== START ====================");
    
    const parseData = JSON.parse(data);
    const { callerId, receiverId, callId, callType, callMode } = parseData;
    console.log("📞 [CALL DISCONNECTED] Parsed data:", parseData);

    const [caller, receiver, callHistory] = await Promise.all([
      User.findById(callerId).select("_id name").lean(),
      Host.findById(receiverId).select("_id name").lean(),
      History.findById(callId).select("_id callConnect callStartTime callEndTime duration"),
    ]);

    console.log("📞 [CALL DISCONNECTED] Database results:", {
      caller: caller ? { _id: caller._id, name: caller.name } : null,
      receiver: receiver ? { _id: receiver._id, name: receiver.name } : null,
      callHistory: callHistory ? { _id: callHistory._id, callConnect: callHistory.callConnect } : null
    });

    if (!caller || !receiver || !callHistory) {
      console.error("❌ [CALL DISCONNECTED] Invalid caller, receiver, or call history");
      return io.to(`globalRoom:${callerId}`).emit("callTerminationFailed", { message: "Invalid call data." });
    }

    io.to(callId.toString()).emit("callDisconnected", data);
    io.socketsLeave(callId.toString());

    console.log(`✅ [CALL DISCONNECTED] Caller: ${caller.name} | Receiver: ${receiver.name} | Call ID: ${callId}`);

    if (callMode.trim().toLowerCase() === "private") {
      console.log("📞 [CALL DISCONNECTED] Processing private call disconnection");
      
      const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
        User.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } }),
        Host.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } }),
        Privatecall.deleteOne({ caller: callerId, receiver: receiverId }),
      ]);

      console.log(`🔹 [CALL DISCONNECTED] Private call status updates:`, {
        callerUpdate: callerUpdate.modifiedCount,
        receiverUpdate: receiverUpdate.modifiedCount,
        privateCallDeleted: privateCallDeleted.deletedCount
      });
    }

    if (callMode.trim().toLowerCase() === "random") {
      console.log("📞 [CALL DISCONNECTED] Processing random call disconnection");
      
      const [callerUpdate, receiverUpdate, randomCallDeleted] = await Promise.all([
        User.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } }),
        Host.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } }),
        Randomcall.deleteOne({ caller: callerId }),
      ]);

      console.log(`🔹 [CALL DISCONNECTED] Random call status updates:`, {
        callerUpdate: callerUpdate.modifiedCount,
        receiverUpdate: receiverUpdate.modifiedCount,
        randomCallDeleted: randomCallDeleted.deletedCount
      });
    }

    callHistory.callConnect = false;
    callHistory.callEndTime = moment().tz("Asia/Kolkata").format();

    const start = moment.tz(callHistory.callStartTime, "Asia/Kolkata");
    const end = moment.tz(callHistory.callEndTime, "Asia/Kolkata");
    const duration = moment.utc(end.diff(start)).format("HH:mm:ss");
    callHistory.duration = duration;

    console.log("📞 [CALL DISCONNECTED] Call duration calculation:", {
      startTime: callHistory.callStartTime,
      endTime: callHistory.callEndTime,
      duration: duration
    });

    await Promise.all([
      Chat.findOneAndUpdate(
        { callId: callHistory._id },
        {
          $set: {
            callDuration: duration,
            messageType: callType.trim().toLowerCase() === "audio" ? 5 : 6,
            message: callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call",
            callType: 1, // 1 = Received Call
            isRead: true,
          },
        },
        { new: true }
      ),
      callHistory.save(),
    ]);

    console.log("✅ [CALL DISCONNECTED] Call history updated with duration");
  });

  socket.on("callCoinCharged", async (data) => {
    try {
      const parsedData = JSON.parse(data);
      console.log("[callCoinCharged] Parsed Data:", parsedData);

      const { callerId, receiverId, callId, callMode, gender } = parsedData;

      const [caller, receiver, callHistory, vipPrivilege] = await Promise.all([
        User.findById(callerId).select("_id coin").lean(),
        Host.findById(receiverId).select("_id coin privateCallRate audioCallRate randomCallFemaleRate randomCallMaleRate agencyId").lean(),
        History.findById(callId).select("_id callType isPrivate").lean(),
        VipPlanPrivilege.findOne().select("audioCallDiscount privateCallDiscount").lean(),
      ]);

      if (!caller || !receiver || !callHistory) {
        console.log("[callCoinCharged] Caller, Receiver, or CallHistory not found!");
        return;
      }

      if (callMode === "private" && callHistory.callType === "audio") {
        const adminCommissionRate = settingJSON?.adminCommissionRate;
        let audioCallCharge = Math.abs(receiver.audioCallRate);
        let audioCallDiscount = 0;

        // Check if user is VIP and apply discount
        if (caller.isVip && caller.vipPrivilege) {
          audioCallDiscount = Math.min(Math.max(vipPrivilege.audioCallDiscount || 0, 0), 100);

          const discountAmount = Math.floor((audioCallCharge * audioCallDiscount) / 100);
          audioCallCharge = audioCallCharge - discountAmount;
        }

        const adminShare = Math.floor((audioCallCharge * adminCommissionRate) / 100);
        const hostEarnings = audioCallCharge - adminShare;
        let agencyShare = 0;

                if (caller.coin >= audioCallCharge) {
                  let agencyUpdate = null;
                  if (receiver.agencyId) {
                    const agency = await Agency.findById(receiver.agencyId).lean().select("_id commissionType commission");
        
                    if (agency) {
                      if (agency.commissionType === 1) {
                        // Percentage commission
                        agencyShare = (hostEarnings * agency.commission) / 100;
                      } else {
                        // Fixed salary, ignore earnings share
                        agencyShare = 0;
                      }
        
                      agencyUpdate = Agency.updateOne(
                        { _id: agency._id },
                        {
                          $inc: {
                            hostCoins: hostEarnings,
                            totalEarnings: Math.floor(agencyShare),
                            netAvailableEarnings: Math.floor(agencyShare),
                          },
                        }
                      );
                    }
                  }
        
                  const uniqueId = await generateHistoryUniqueId();
        
                  await Promise.all([
                    User.updateOne(
                      { _id: caller._id, coin: { $gte: audioCallCharge } },
                      {
                        $inc: {
                          coin: -audioCallCharge,
                          spentCoins: audioCallCharge,
                        },
                      }
                    ),
                    Host.updateOne({ _id: receiver._id }, { $inc: { coin: hostEarnings } }),
                    History.create({
                      uniqueId: uniqueId,
                      type: 11,
                      userId: caller._id,
                      hostId: receiver._id,
                      agencyId: receiver?.agencyId,
                      userCoin: audioCallCharge,
                      hostCoin: hostEarnings,
                      adminCoin: adminShare,
                      agencyCoin: Math.floor(agencyShare),
                      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
                    }),
                    agencyUpdate,
                  ]);
        
                  console.log(`✅ [CALL COIN CHARGED] Audio call coins charged: ${audioCallCharge} | Admin: ${adminShare} | Host: ${hostEarnings}`);
                } else {
                  console.log("❌ [CALL COIN CHARGED] Insufficient coins for audio call");
                  io.in("globalRoom:" + caller._id.toString()).emit("insufficientCoins", "Insufficient coins for call.");
                }
              }
            } catch (error) {
              console.error("❌ [CALL COIN CHARGED] Error:", error);
            }
          });
        
          //disconnect
          socket.on("disconnect", async () => {
            console.log("🔌 [SOCKET DISCONNECT] Client disconnected:", socket.id);
            
            if (globalRoom) {
              const id = globalRoom.split(":")[1];
              if (id && mongoose.Types.ObjectId.isValid(id)) {
                const user = await User.findById(id).select("_id isOnline").lean();
        
                if (user) {
                  await User.findByIdAndUpdate(user._id, { $set: { isOnline: false } }, { new: true });
                  console.log(`👤 [SOCKET DISCONNECT] User ${user._id} set to offline`);
                } else {
                  const host = await Host.findOne({ _id: id, status: 2 }).select("_id isOnline").lean();
        
                  if (host) {
                    await Host.findByIdAndUpdate(host._id, { $set: { isOnline: false } }, { new: true });
                    console.log(`🎭 [SOCKET DISCONNECT] Host ${host._id} set to offline`);
                  }
                }
              }
            }
          });
        });
