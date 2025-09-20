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

const agoraSettings = {
  agoraAppId: "3b4fe627b863435eaa54175cd133eeba",
  agoraAppCertificate: "4988588782c64770b4ab32ca6bae215b",
  adminCommissionRate: 10,
  maxFreeChatMessages: 10,
};

console.log("🔧 Agora Settings Initialized:", agoraSettings);

io.on("connection", async (socket) => {
  console.log("✅ Socket Connection done Client ID: ", socket.id);
  
  // ADD THIS DEBUG LOG
  const { globalRoom } = socket.handshake.query;
  console.log("🔍 DEBUG: globalRoom received:", globalRoom);
  console.log("🔍 DEBUG: Full handshake query:", socket.handshake.query);
  
  if (!globalRoom) {
    console.error("❌ No globalRoom provided in handshake");
    return;
  }

  const id = globalRoom.split(":")[1];
  console.log("🔍 DEBUG: Extracted ID from globalRoom:", id);
  
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    console.warn("❌ Invalid or missing ID from globalRoom:", globalRoom);
    return;
  }

  console.log("✅ Socket connected with valid ID:", id);

  if (globalRoom) {
    if (!socket.rooms.has(globalRoom)) {
      socket.join(globalRoom);
      console.log(`✅ Socket joined room: ${globalRoom}`);
    } else {
      console.log(`⚠️ Socket is already in room: ${globalRoom}`);
    }

    console.log("🔍 Searching for user with ID:", id);
    const user = await User.findById(id).select("_id isOnline").lean();

    if (user) {
      console.log("👤 User found, updating online status:", user._id);
      await User.findByIdAndUpdate(user._id, { $set: { isOnline: true } }, { new: true });
      console.log("✅ User online status updated");
    } else {
      console.log("👤 User not found, searching for host with ID:", id);
      const host = await Host.findOne({ _id: id, status: 2 }).select("_id isOnline").lean();

      if (host) {
        console.log("🎭 Host found, updating online status:", host._id);
        await Host.findByIdAndUpdate(host._id, { $set: { isOnline: true } }, { new: true });
        console.log("✅ Host online status updated");
      } else {
        console.log("❌ Neither user nor host found with ID:", id);
      }
    }
  } else {
    console.warn("❌ Invalid globalRoom format:", globalRoom);
  }

  //chat
socket.on("chatMessageSent", async (data) => {
  console.log("🔹 Raw data received:", data);
  
  const parseData = JSON.parse(data);
  console.log("🔹 Parsed data:", parseData);
  console.log("🔹 Message type:", parseData?.messageType);
  console.log("🔹 Sender role:", parseData?.senderRole);
  console.log("🔹 Receiver role:", parseData?.receiverRole);
    
    let senderPromise, receiverPromise;

    if (parseData?.senderRole === "user") {
      console.log("🔍 Looking up sender as user:", parseData?.senderId);
      senderPromise = User.findById(parseData?.senderId).lean().select("_id name image coin isVip");
    } else if (parseData?.senderRole === "host") {
      console.log("🔍 Looking up sender as host:", parseData?.senderId);
      senderPromise = Host.findById(parseData?.senderId).lean().select("_id name image coin");
    }

    if (parseData?.receiverRole === "host") {
      console.log("🔍 Looking up receiver as host:", parseData?.receiverId);
      receiverPromise = Host.findById(parseData?.receiverId).lean().select("_id name image fcmToken isBlock coin chatRate agencyId");
    } else if (parseData?.receiverRole === "user") {
      console.log("🔍 Looking up receiver as user:", parseData?.receiverId);
      receiverPromise = User.findById(parseData?.receiverId).lean().select("_id name image fcmToken isBlock coin");
    }

    const chatTopicPromise = ChatTopic.findById(parseData?.chatTopicId).lean().select("_id senderId receiverId chatId messageCount");

    const [uniqueId, sender, receiver, chatTopic] = await Promise.all([generateHistoryUniqueId(), senderPromise, receiverPromise, chatTopicPromise]);

    console.log("🔍 Query results - Sender:", sender ? "Found" : "Not found");
    console.log("🔍 Query results - Receiver:", receiver ? "Found" : "Not found");
    console.log("🔍 Query results - ChatTopic:", chatTopic ? "Found" : "Not found");

    if (!chatTopic) {
      console.log("❌ Chat topic not found");
      return;
    }

    if (parseData?.messageType == 1) {
      console.log("💬 Processing text message");
      
      if (parseData.senderRole === "user" && parseData.receiverRole === "host") {
        let maxFreeChatMessages = agoraSettings.maxFreeChatMessages;

        console.log("💬 [SOCKET CHAT] Using hardcoded maxFreeChatMessages:", maxFreeChatMessages);

        //Check if sender is VIP
        if (sender?.isVip) {
          console.log("👑 Sender is VIP, checking for VIP privileges");
          const vipPrivilege = await VipPlanPrivilege.findOne().select("freeMessages").lean();
          if (vipPrivilege?.freeMessages) {
            maxFreeChatMessages = vipPrivilege.freeMessages;
            console.log("👑 VIP free messages applied:", maxFreeChatMessages);
          }
        }

        const isWithinFreeLimit = chatTopic.messageCount < maxFreeChatMessages;
        const chatRate = receiver.chatRate || 10;

        console.log("💰 Chat economics - Message count:", chatTopic.messageCount);
        console.log("💰 Chat economics - Free limit:", maxFreeChatMessages);
        console.log("💰 Chat economics - Within free limit:", isWithinFreeLimit);
        console.log("💰 Chat economics - Chat rate:", chatRate);
        console.log("💰 Chat economics - Sender coins:", sender?.coin);

        if (!isWithinFreeLimit && sender?.coin < chatRate) {
          console.log("❌ Insufficient coins, message not sent.");
          io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("insufficientCoins", "Insufficient coins to send message.");
          return;
        }
      }

      console.log("💾 Creating new chat message");
      const chat = new Chat({
        messageType: parseData?.messageType,
        senderId: parseData?.senderId,
        message: parseData?.message,
        image: parseData?.image || "",
        chatTopicId: chatTopic._id,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
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

      console.log("✅ Chat message saved with ID:", chat._id);

      const eventData = {
        data,
        messageId: chat._id.toString(),
      };

      console.log("📤 Emitting chat message to rooms");
      io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("chatMessageSent", eventData);
      io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("chatMessageSent", eventData);

      if (parseData.senderRole === "user" && parseData.receiverRole === "host") {
        console.log("💰 Processing coin deduction for user-to-host message");
        
        const maxFreeChatMessages = agoraSettings.maxFreeChatMessages;
        const adminCommissionRate = agoraSettings.adminCommissionRate;
        const isWithinFreeLimit = chatTopic.messageCount < maxFreeChatMessages;
        const chatRate = receiver.chatRate || 10;

        console.log("💰 Using hardcoded adminCommissionRate:", adminCommissionRate);
        console.log("💰 Chat rate for deduction:", chatRate);

        let deductedCoins = 0;
        let adminShare = 0;
        let hostEarnings = 0;
        let agencyShare = 0;

        if (!isWithinFreeLimit && sender.coin >= chatRate) {
          console.log("💰 Proceeding with coin deduction");
          
          deductedCoins = chatRate;
          adminShare = (chatRate * adminCommissionRate) / 100;
          hostEarnings = chatRate - adminShare;

          console.log("💰 Calculated - Deducted:", deductedCoins, "Admin:", adminShare, "Host:", hostEarnings);

          let agencyUpdate = null;
          if (receiver.agencyId) {
            console.log("🏢 Processing agency commission for:", receiver.agencyId);
            const agency = await Agency.findById(receiver.agencyId).lean().select("_id commissionType commission");

            if (agency) {
              console.log("🏢 Agency found - Type:", agency.commissionType, "Commission:", agency.commission);
              
              if (agency.commissionType === 1) {
                // Percentage commission
                agencyShare = (hostEarnings * agency.commission) / 100;
                console.log("🏢 Agency percentage commission calculated:", agencyShare);
              } else {
                // Fixed salary, ignore earnings share
                agencyShare = 0;
                console.log("🏢 Agency fixed salary, no commission share");
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

          console.log("💾 Updating user and host coins, creating history");
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

          console.log(`💰 Coins Deducted: ${deductedCoins} | Admin: ${adminShare} | Host Earnings: ${hostEarnings}`);
        } else {
          console.log("💰 No coin deduction needed (within free limit or insufficient coins)");
        }
      }

      if (receiver && receiver.fcmToken) {
        console.log("🔔 Checking if notification should be sent");
        
        const isBlocked = await Block.findOne({
          $or: [
            { userId: sender._id, hostId: receiver._id },
            { userId: receiver._id, hostId: sender._id },
          ],
        });

        if (!isBlocked) {
          console.log("🔔 Sending FCM notification");
          
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
            console.log("✅ Successfully sent FCM notification: ", response);
          } catch (error) {
            console.log("❌ Error sending FCM message:", error);
          }
        } else {
          console.log("🚫 Notification not sent. Block exists between sender and receiver.");
        }
      }
    } else {
      console.log("ℹ️ Other message type received");

      const eventData = {
        data,
        messageId: parseData?.messageId?.toString() || "",
      };

      io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("chatMessageSent", eventData);
      io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("chatMessageSent", eventData);
    }
  });

  socket.on("chatGiftSent", async (data) => {
    const parseData = JSON.parse(data);
    console.log("🎁 Data in chatGiftSent:", parseData);

    let senderPromise, receiverPromise;

    if (parseData?.senderRole === "user") {
      console.log("🔍 Looking up gift sender as user:", parseData?.senderId);
      senderPromise = User.findById(parseData?.senderId).lean().select("_id name coin");
    } else if (parseData?.senderRole === "host") {
      console.log("🔍 Looking up gift sender as host:", parseData?.senderId);
      senderPromise = Host.findById(parseData?.senderId).lean().select("_id name coin");
    }

    if (parseData?.receiverRole === "host") {
      console.log("🔍 Looking up gift receiver as host:", parseData?.receiverId);
      receiverPromise = Host.findById(parseData?.receiverId).lean().select("_id fcmToken isBlock coin agencyId");
    } else if (parseData?.receiverRole === "user") {
      console.log("🔍 Looking up gift receiver as user:", parseData?.receiverId);
      receiverPromise = User.findById(parseData?.receiverId).lean().select("_id fcmToken isBlock coin");
    }

    const chatTopicPromise = ChatTopic.findById(parseData?.chatTopicId).lean().select("_id senderId receiverId chatId");
    const giftPromise = Gift.findById(parseData?.giftId).lean().select("_id coin image type");

    const [uniqueId, sender, receiver, chatTopic, gift] = await Promise.all([generateHistoryUniqueId(), senderPromise, receiverPromise, chatTopicPromise, giftPromise]);

    console.log("🔍 Gift query results - Sender:", sender ? "Found" : "Not found");
    console.log("🔍 Gift query results - Receiver:", receiver ? "Found" : "Not found");
    console.log("🔍 Gift query results - ChatTopic:", chatTopic ? "Found" : "Not found");
    console.log("🔍 Gift query results - Gift:", gift ? "Found" : "Not found");

    if (!chatTopic) {
      console.log("❌ Chat topic not found");
      return;
    }

    if (!gift) {
      console.log("❌ Gift not found");
      return;
    }

    const giftPrice = gift?.coin || 0;
    const giftCount = parseData?.giftCount || 1;
    const totalGiftCost = giftPrice * giftCount;
    const adminCommissionRate = agoraSettings.adminCommissionRate;

    console.log("🎁 Gift economics - Price per gift:", giftPrice);
    console.log("🎁 Gift economics - Gift count:", giftCount);
    console.log("🎁 Gift economics - Total cost:", totalGiftCost);
    console.log("🎁 Gift economics - Sender coins:", sender?.coin);
    console.log("🎁 Gift economics - Admin commission rate:", adminCommissionRate);

    if (sender?.coin < totalGiftCost) {
      console.log("❌ Insufficient coins, gift not sent.");
      io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("insufficientCoins", "Insufficient coins to send gift.");
      return;
    }

    console.log("💾 Creating gift chat message");
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

    await Promise.all([
      chat.save(),
      ChatTopic.updateOne(
        { _id: chatTopic._id },
        {
          $set: { chatId: chat._id },
        }
      ),
    ]);

    console.log("✅ Gift chat message saved");

    const eventData = {
      data,
      messageId: chat._id.toString(),
    };

    console.log("📤 Emitting gift sent event");
    io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("chatGiftSent", eventData);
    io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("chatGiftSent", eventData);

    let adminShare = (totalGiftCost * adminCommissionRate) / 100;
    let hostEarnings = totalGiftCost - adminShare;
    let agencyShare = 0;

    console.log("💰 Gift earnings - Admin share:", adminShare);
    console.log("💰 Gift earnings - Host earnings:", hostEarnings);

    let agencyUpdate = null;
    if (receiver.agencyId) {
      console.log("🏢 Processing agency commission for gift");
      const agency = await Agency.findById(receiver.agencyId).lean().select("_id commissionType commission");

      if (agency) {
        if (agency.commissionType === 1) {
          // Percentage commission
          agencyShare = (hostEarnings * agency.commission) / 100;
          console.log("🏢 Agency percentage commission for gift:", agencyShare);
        } else {
          // Fixed salary, ignore earnings share
          agencyShare = 0;
          console.log("🏢 Agency fixed salary for gift, no commission");
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

    console.log("💾 Processing gift payment transactions");
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

    console.log(`💰 Gift Sent | Cost: ${totalGiftCost} | Admin Share: ${adminShare} | Host Earnings: ${hostEarnings}`);

    if (receiver && !receiver.isBlock && receiver.fcmToken) {
      console.log("🔔 Sending gift FCM notification");
      
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
        console.log("✅ Successfully sent FCM notification for gift:", response);
      } catch (error) {
        console.log("❌ Error sending FCM message:", error);
      }
    }
  });

  socket.on("chatMessageSeen", async (data) => {
    try {
      const parsedData = JSON.parse(data);
      console.log("🔹 Data in chatMessageSeen event:", parsedData);

      const updated = await Chat.findByIdAndUpdate(parsedData.messageId, { $set: { isRead: true } }, { new: true, lean: true, select: "_id isRead" });

      if (!updated) {
        console.log(`No message found with ID ${parsedData.messageId}`);
      } else {
        console.log(`Updated isRead to true for message with ID: ${updated._id}`);
      }
    } catch (error) {
      console.error("Error updating chatMessageSeen:", error);
    }
  });

  //private video call
  socket.on("callRinging", async (data) => {
    const parsedData = JSON.parse(data);
    console.log("📞 callRinging request received:", parsedData);

    const { callerId, receiverId, agoraUID, channel, callType } = parsedData;

    console.log("🔧 Using hardcoded Agora settings for token generation");
    console.log("🔧 Agora App ID:", agoraSettings.agoraAppId);
    console.log("🔧 Agora App Certificate:", agoraSettings.agoraAppCertificate ? "Present" : "Missing");

    const role = RtcRole.PUBLISHER;
    const uid = agoraUID ? agoraUID : 0;
    const expirationTimeInSeconds = 24 * 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const [callUniqueId, token, caller, receiver] = await Promise.all([
      generateHistoryUniqueId(),
      RtcTokenBuilder.buildTokenWithUid(agoraSettings.agoraAppId, agoraSettings.agoraAppCertificate, channel, uid, role, privilegeExpiredTs),
      User.findById(callerId).select("_id name image isBlock isBusy callId isOnline uniqueId").lean(),
      Host.findById(receiverId).select("_id name image isBlock isBusy callId isOnline uniqueId").lean(),
    ]);

    console.log("🔍 Call participants - Caller:", caller ? caller.name : "Not found");
    console.log("🔍 Call participants - Receiver:", receiver ? receiver.name : "Not found");
    console.log("🎫 Generated token:", token ? "Success" : "Failed");

    if (!caller) {
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", { message: "Caller does not found." });
      return;
    }

    if (caller.isBlock) {
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Caller is blocked.",
        isBlock: true,
      });
      return;
    }

    if (caller.isBusy && caller.callId) {
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Caller is busy with someone else.",
        isBusy: true,
      });
      return;
    }

    if (!receiver) {
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", { message: "Receiver does not found." });
      return;
    }

    if (receiver.isBlock) {
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Receiver is blocked.",
        isBlock: true,
      });
      return;
    }

    if (!receiver.isOnline) {
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Receiver is not online.",
        isOnline: false,
      });
      return;
    }

    if (receiver.isBusy && receiver.callId) {
      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Receiver is busy with another call.",
        isBusy: true,
      });
      return;
    }

    if (!receiver.isBusy && receiver.callId === null) {
      console.log("✅ Receiver and Caller are free. Proceeding with call setup.");

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

        io.in("globalRoom:" + receiver._id.toString()).emit("callIncoming", dataOfVideoCall); // Notify receiver
        io.in("globalRoom:" + caller._id.toString()).emit("callConnected", dataOfVideoCall); // Notify caller

        console.log(`Call successfully initiated: ${caller.name} → ${receiver.name}`);

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
      } else {
        console.log("Failed to verify caller or receiver availability");

        io.in("globalRoom:" + caller._id.toString()).emit("callRinging", {
          message: "Call setup failed. One or both users became unavailable.",
          isBusy: true,
        });

        // Update isBusy only for the user who failed verification
        if (callerVerify.modifiedCount > 0) {
          await User.updateOne({ _id: callerId, isBusy: true }, { $set: { isBusy: false, callId: null } });
          console.log(`🔹 Caller Status Updated: Caller verification failed, isBusy reset`);
        }

        if (receiverVerify.modifiedCount > 0) {
          await Host.updateOne({ _id: receiverId, isBusy: true }, { $set: { isBusy: false, callId: null } });
          console.log(`🔹 Receiver Status Updated: Receiver verification failed, isBusy reset`);
        }
        return;
      }
    } else {
      console.log("Condition not met - receiver not available");

      io.in("globalRoom:" + callerId.toString()).emit("callRinging", {
        message: "Receiver is unavailable for a call at this moment.",
        isBusy: true,
      });
      return;
    }
  });

  socket.on("callResponseHandled", async (data) => {
    try {
      const parsedData = JSON.parse(data);

      const { callerId, receiverId, callId, isAccept, callType, callMode } = parsedData;
      console.log("🟢 [callResponseHandled] Event received:", parsedData);

      const callerRoom = `globalRoom:${callerId}`;
      const receiverRoom = `globalRoom:${receiverId}`;

      console.log(`🔄 Fetching caller, receiver, and call history for callId: ${callId}`);

      const [caller, receiver, callHistory] = await Promise.all([
        User.findById(callerId).select("_id name isBusy callId").lean(),
        Host.findById(receiverId).select("_id name isBusy callId").lean(),
        History.findById(callId).select("_id callConnect callEndTime duration"),
      ]);

      if (!caller || !receiver || !callHistory) {
        console.error("❌ [callResponseHandled] Invalid caller, receiver, or call history.");
        return io.to(callerRoom).emit("callResponseHandled", { message: "Invalid call data." });
      }

      console.log(`✅ Caller: ${caller.name} | Receiver: ${receiver.name} | Call ID: ${callId}`);

      if (callMode.trim().toLowerCase() === "private") {
        if (!isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📵 [callResponseHandled] Call rejected by receiver ${receiver.name}`);

          io.to(callerRoom).emit("callRejected", data);
          io.to(receiverRoom).emit("callRejected", data);

          const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
            User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
            Host.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
            Privatecall.deleteOne({ caller: caller._id, receiver: receiver._id }),
          ]);

          console.log(`🔹 Caller Status Updated:`, callerUpdate);
          console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
          console.log(`🔹 Private Call Deleted:`, privateCallDeleted);

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
          console.log("✅ Call rejection chat & history saved.");
          return;
        }

        if (isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📞 [callResponseHandled] Call accepted by receiver ${receiver.name}`);

          const privateCallDelete = await Privatecall.deleteOne({
            caller: new mongoose.Types.ObjectId(caller._id),
            receiver: new mongoose.Types.ObjectId(receiver._id),
          });

          console.log("🗑 Private call entry deleted:", privateCallDelete);

          if (privateCallDelete?.deletedCount > 0) {
            console.log("🟢 Call accepted, emitting event...");

            const [callerSockets, receiverSockets] = await Promise.all([io.in(callerRoom).fetchSockets(), io.in(receiverRoom).fetchSockets()]);

            const callerSocket = callerSockets?.[0];
            const receiverSocket = receiverSockets?.[0];

            if (callerSocket && !callerSocket.rooms.has(callId)) {
              callerSocket.join(callId);
            }

            if (receiverSocket && !receiverSocket.rooms.has(callId)) {
              receiverSocket.join(callId);
            }

            io.to(callId.toString()).emit("callAnswerReceived", data);

            console.log(`📡 [callAnswerReceived] Event sent to both parties: Caller(${caller.name}) & Receiver(${receiver.name})`);

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

            console.log("✅ Caller and Receiver status updated & call history saved.");
          } else {
            console.log(`🚨 Call disconnected`);

            io.to(receiverRoom).emit("callAutoEnded", data);

            await Promise.all([
              User.updateOne({ _id: caller._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
              Host.updateOne({ _id: receiver._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
            ]);

            console.log("🔹 Caller & Receiver status reset.");
          }
        }
      }

      if (callMode.trim().toLowerCase() === "random") {
        if (!isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📵 [callResponseHandled] Call rejected by receiver ${receiver.name}`);

          io.to(callerRoom).emit("callRejected", data);
          io.to(receiverRoom).emit("callRejected", data);

          const [callerUpdate, receiverUpdate, randomCallDeleted] = await Promise.all([
            User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
            Host.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
            Randomcall.deleteOne({ caller: caller._id }),
          ]);

          console.log(`🔹 Caller Status Updated:`, callerUpdate);
          console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
          console.log(`🔹 Random Call Deleted:`, randomCallDeleted);

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
          console.log("✅ Call rejection chat & history saved.");
          return;
        }

        if (isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📞 [callResponseHandled] Call accepted by receiver ${receiver.name}`);

          const randomCallDeleted = await Randomcall.deleteOne({
            caller: new mongoose.Types.ObjectId(caller._id),
          });

          console.log("🗑 Private call entry deleted:", randomCallDeleted);

          if (randomCallDeleted?.deletedCount > 0) {
            console.log("🟢 Call accepted, emitting event...");

            const [callerSockets, receiverSockets] = await Promise.all([io.in(callerRoom).fetchSockets(), io.in(receiverRoom).fetchSockets()]);

            const callerSocket = callerSockets?.[0];
            const receiverSocket = receiverSockets?.[0];

            if (callerSocket && !callerSocket.rooms.has(callId)) {
              callerSocket.join(callId);
            }

            if (receiverSocket && !receiverSocket.rooms.has(callId)) {
              receiverSocket.join(callId);
            }

            io.to(callId.toString()).emit("callAnswerReceived", data);

            console.log(`📡 [callAnswerReceived] Event sent to both parties: Caller(${caller.name}) & Receiver(${receiver.name})`);

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

            console.log("✅ Caller and Receiver status updated & call history saved.");
          } else {
            console.log(`🚨 Call disconnected`);

            io.to(receiverRoom).emit("callAutoEnded", data);

            await Promise.all([
              User.updateOne({ _id: caller._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
              Host.updateOne({ _id: receiver._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
            ]);

            console.log("🔹 Caller & Receiver status reset.");
          }
        }
      }
    } catch (error) {
      console.error("❌ [callResponseHandled] Error:", error);
      io.to(`globalRoom:${socket.id}`).emit("callResponseHandled", { message: "Server error. Please try again." });
    }
  });

  socket.on("callCancelled", async (data) => {
    const parseData = JSON.parse(data);
    const { callerId, receiverId, callId, callType, callMode } = parseData;
    console.log("🟢 [callCancelled] Event received:", parseData);

    console.log(`🔄 Fetching call details for callId: ${callId}`);

    const [caller, receiver, callHistory] = await Promise.all([
      User.findById(callerId).select("_id name fcmToken isBlock").lean(),
      Host.findById(receiverId).select("_id name fcmToken isBlock").lean(),
      History.findById(callId).select("_id userId callConnect"),
    ]);

    if (!caller || !receiver || !callHistory) {
      console.error("❌ [callCancelled] Invalid caller, receiver, or call history.");
      return io.to(`globalRoom:${callerId}`).emit("callCancelFailed", { message: "Invalid call data." });
    }

    io.to("globalRoom:" + callerId).emit("callFinished", data);
    io.to("globalRoom:" + receiverId).emit("callFinished", data);

    console.log(`✅ Caller: ${caller.name} | Receiver: ${receiver.name} | Call ID: ${callId}`);

    if (callMode.trim().toLowerCase() === "private") {
      const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
        User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
        Host.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
        Privatecall.deleteOne({ caller: caller._id, receiver: receiver._id }),
      ]);

      console.log(`🔹 Caller Status Updated:`, callerUpdate);
      console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
      console.log(`🔹 Private Call Deleted:`, privateCallDeleted);
    }

    if (callMode.trim().toLowerCase() === "random") {
      const [callerUpdate, receiverUpdate, randomCallDeleted] = await Promise.all([
        User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
        Host.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
        Randomcall.deleteOne({ caller: caller._id }),
      ]);

      console.log(`🔹 Caller Status Updated:`, callerUpdate);
      console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
      console.log(`🔹 Private Call Deleted:`, randomCallDeleted);
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
      chatTopic = new ChatTopic();

      chatTopic.chatId = chat._id;
      chatTopic.senderId = caller._id;
      chatTopic.receiverId = receiver._id;
      await chatTopic.save();
    }

    chat.chatTopicId = chatTopic._id;
    chat.senderId = callHistory?.userId;
    chat.messageType = callType.trim().toLowerCase() === "audio" ? 5 : 6;
    chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
    chat.callType = 3; //3.missedCall
    chat.date = new Date().toLocaleString();
    chat.isRead = true;

    chatTopic.chatId = chat._id;

    await Promise.all([chat?.save(), chatTopic?.save(), callHistory?.save()]);

    if (!receiver.isBlock && receiver.fcmToken !== null) {
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
          console.log("Successfully sent with response: ", response);
        })
        .catch((error) => {
          console.log("Error sending message:      ", error);
        });
    }
  });

  socket.on("callDisconnected", async (data) => {
    const parseData = JSON.parse(data);
    const { callerId, receiverId, callId, callType, callMode } = parseData;
    console.log("[callDisconnected]", "data in callDisconnected:", parseData);

    const [caller, receiver, callHistory] = await Promise.all([
      User.findById(callerId).select("_id name").lean(),
      Host.findById(receiverId).select("_id name").lean(),
      History.findById(callId).select("_id callConnect callStartTime callEndTime duration"),
    ]);

    if (!caller || !receiver || !callHistory) {
      console.error("❌ [callDisconnected] Invalid caller, receiver, or call history.");
      return io.to(`globalRoom:${callerId}`).emit("callTerminationFailed", { message: "Invalid call data." });
    }

    io.to(callId.toString()).emit("callDisconnected", data);
    io.socketsLeave(callId.toString());

    console.log(`✅ Caller: ${caller.name} | Receiver: ${receiver.name} | Call ID: ${callId}`);

    if (callMode.trim().toLowerCase() === "private") {
      const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
        User.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } }),
        Host.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } }),
        Privatecall.deleteOne({ caller: callerId, receiver: receiverId }),
      ]);

      console.log(`🔹 Caller Status Updated:`, callerUpdate);
      console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
      console.log(`🔹 Private Call Deleted:`, privateCallDeleted);
    }

    if (callMode.trim().toLowerCase() === "random") {
      const [callerUpdate, receiverUpdate, randomCallDeleted] = await Promise.all([
        User.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } }),
        Host.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } }),
        Randomcall.deleteOne({ caller: callerId }),
      ]);

      console.log(`🔹 Caller Status Updated:`, callerUpdate);
      console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
      console.log(`🔹 Private Call Deleted:`, randomCallDeleted);
    }

    callHistory.callConnect = false;
    callHistory.callEndTime = moment().tz("Asia/Kolkata").format();

    const start = moment.tz(callHistory.callStartTime, "Asia/Kolkata");
    const end = moment.tz(callHistory.callEndTime, "Asia/Kolkata");
    const duration = moment.utc(end.diff(start)).format("HH:mm:ss");
    callHistory.duration = duration;

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
  });

  socket.on("callCoinCharged", async (data) => {
    try {
      const parsedData = JSON.parse(data);
      console.log("💰 [callCoinCharged] Parsed Data:", parsedData);

      const { callerId, receiverId, callId, callMode, gender } = parsedData;

      const [caller, receiver, callHistory, vipPrivilege] = await Promise.all([
        User.findById(callerId).select("_id coin isVip").lean(),
        Host.findById(receiverId).select("_id coin privateCallRate audioCallRate randomCallFemaleRate randomCallMaleRate agencyId").lean(),
        History.findById(callId).select("_id callType isPrivate isRandom").lean(),
        VipPlanPrivilege.findOne().select("audioCallDiscount privateCallDiscount randomMatchCallDiscount").lean(),
      ]);

      console.log("🔍 Call coin charge participants found:", {
        caller: caller ? "Yes" : "No",
        receiver: receiver ? "Yes" : "No", 
        callHistory: callHistory ? "Yes" : "No"
      });

      if (!caller || !receiver || !callHistory) {
        console.log("❌ [callCoinCharged] Caller, Receiver, or CallHistory not found!");
        return;
      }

      console.log("💰 Using hardcoded adminCommissionRate:", agoraSettings.adminCommissionRate);

      if (callMode === "private" && callHistory.callType === "audio") {
        console.log("🎵 Processing audio call charges");
        
        const adminCommissionRate = agoraSettings.adminCommissionRate;
        let audioCallCharge = Math.abs(receiver.audioCallRate);
        let audioCallDiscount = 0;

        console.log("🎵 Base audio call charge:", audioCallCharge);

        // Check if user is VIP and apply discount
        if (caller.isVip && vipPrivilege) {
          console.log("👑 Applying VIP discount for audio call");
          audioCallDiscount = Math.min(Math.max(vipPrivilege.audioCallDiscount || 0, 0), 100);

          const discountAmount = Math.floor((audioCallCharge * audioCallDiscount) / 100);
          audioCallCharge = audioCallCharge - discountAmount;
          console.log("👑 VIP discount applied - Original:", receiver.audioCallRate, "Discounted:", audioCallCharge);
        }

        const adminShare = Math.floor((audioCallCharge * adminCommissionRate) / 100);
        const hostEarnings = audioCallCharge - adminShare;
        let agencyShare = 0;

        console.log("💰 Audio call economics - Charge:", audioCallCharge, "Admin:", adminShare, "Host:", hostEarnings);

        if (caller.coin >= audioCallCharge) {
          let agencyUpdate = null;
          if (receiver.agencyId) {
            console.log("🏢 Processing agency commission for audio call");
            const agency = await Agency.findById(receiver.agencyId).lean().select("_id commissionType commission");

            if (agency) {
              if (agency.commissionType === 1) {
                // Percentage commission
                agencyShare = (hostEarnings * agency.commission) / 100;
                console.log("🏢 Agency percentage commission for audio call:", agencyShare);
              } else {
                // Fixed salary, ignore earnings share
                agencyShare = 0;
                console.log("🏢 Agency fixed salary for audio call, no commission");
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

          console.log("💾 Updating user and host coins, creating history for audio call");
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
            History.updateOne(
              { _id: callHistory._id, userId: caller._id, hostId: receiver._id },
              {
                $set: {
                  agencyId: receiver.agencyId,
                  date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
                },
                $inc: {
                  userCoin: audioCallCharge,
                  hostCoin: hostEarnings,
                  adminCoin: adminShare,
                  agencyCoin: Math.floor(agencyShare),
                },
              }
            ),
            agencyUpdate,
          ]);

          console.log("[callCoinCharged] Coin deduction and history update successful for audio call.");
        } else {
          console.log(`[callCoinCharged] Insufficient Coins for Caller: ${caller._id}`);
          io.in("globalRoom:" + caller._id.toString()).emit("insufficientCoins", "You don't have sufficient coins.");
        }
      }

      if (callMode === "private" && callHistory.callType === "video" && callHistory.isPrivate) {
        console.log("📹 Processing private video call charges");
        
        const adminCommissionRate = agoraSettings.adminCommissionRate;
        let privateCallCharge = Math.abs(receiver.privateCallRate);
        let privateCallDiscount = 0;

        console.log("📹 Base private call charge:", privateCallCharge);

        // Check if user is VIP and apply discount
        if (caller.isVip && vipPrivilege) {
          console.log("👑 Applying VIP discount for private call");
          privateCallDiscount = Math.min(Math.max(vipPrivilege.privateCallDiscount || 0, 0), 100);

          const discountAmount = Math.floor((privateCallCharge * privateCallDiscount) / 100);
          privateCallCharge = privateCallCharge - discountAmount;
          console.log("👑 VIP discount applied - Original:", receiver.privateCallRate, "Discounted:", privateCallCharge);
        }

        const adminShare = Math.floor((privateCallCharge * adminCommissionRate) / 100);
        const hostEarnings = privateCallCharge - adminShare;
        let agencyShare = 0;

        console.log("💰 Private call economics - Charge:", privateCallCharge, "Admin:", adminShare, "Host:", hostEarnings);

        if (caller.coin >= privateCallCharge) {
          let agencyUpdate = null;
          if (receiver.agencyId) {
            console.log("🏢 Processing agency commission for private call");
            const agency = await Agency.findById(receiver.agencyId).lean().select("_id commissionType commission");

            if (agency) {
              if (agency.commissionType === 1) {
                // Percentage commission
                agencyShare = (hostEarnings * agency.commission) / 100;
                console.log("🏢 Agency percentage commission for private call:", agencyShare);
              } else {
                // Fixed salary, ignore earnings share
                agencyShare = 0;
                console.log("🏢 Agency fixed salary for private call, no commission");
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

          console.log("💾 Updating user and host coins, creating history for private call");
          await Promise.all([
            User.updateOne(
              { _id: caller._id, coin: { $gte: privateCallCharge } },
              {
                $inc: {
                  coin: -privateCallCharge,
                  spentCoins: privateCallCharge,
                },
              }
            ),
            Host.updateOne({ _id: receiver._id }, { $inc: { coin: hostEarnings } }),
            History.updateOne(
              { _id: callHistory._id, userId: caller._id, hostId: receiver._id },
              {
                $set: {
                  agencyId: receiver.agencyId,
                  date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
                },
                $inc: {
                  userCoin: privateCallCharge,
                  hostCoin: hostEarnings,
                  adminCoin: adminShare,
                  agencyCoin: Math.floor(agencyShare),
                },
              }
            ),
            agencyUpdate,
          ]);

          console.log("[callCoinCharged] Coin deduction and history update successful for private call.");
        } else {
          console.log(`[callCoinCharged] Insufficient Coins for Caller: ${caller._id}`);
          io.in("globalRoom:" + caller._id.toString()).emit("insufficientCoins", "You don't have sufficient coins.");
        }
      }

      if (callMode === "random" && callHistory.callType === "video" && callHistory.isRandom) {
        console.log("🎲 Processing random video call charges");
        
        const genderQuery = gender?.toLowerCase();
        console.log("🎲 Gender preference:", genderQuery);

        let randomCallCharge;
        if (genderQuery === "female") {
          randomCallCharge = Math.abs(receiver.randomCallFemaleRate);
          console.log("🎲 Using female rate:", randomCallCharge);
        } else if (genderQuery === "male") {
          randomCallCharge = Math.abs(receiver.randomCallMaleRate);
          console.log("🎲 Using male rate:", randomCallCharge);
        } else {
          randomCallCharge = Math.abs(receiver.randomCallRate) || 100;
          console.log("🎲 Using default rate:", randomCallCharge);
        }

        // Check if user is VIP and apply discount
        let randomCallDiscount = 0;
        if (caller.isVip && vipPrivilege) {
          console.log("👑 Applying VIP discount for random call");
          randomCallDiscount = Math.min(Math.max(vipPrivilege.randomMatchCallDiscount || 0, 0), 100);

          const discountAmount = Math.floor((randomCallCharge * randomCallDiscount) / 100);
          randomCallCharge = randomCallCharge - discountAmount;
          console.log("👑 VIP discount applied - Original rate, Discounted:", randomCallCharge);
        }

        const adminCommissionRate = agoraSettings.adminCommissionRate;
        const adminShare = Math.floor((randomCallCharge * adminCommissionRate) / 100);
        const hostEarnings = randomCallCharge - adminShare;
        let agencyShare = 0;

        console.log("💰 Random call economics - Charge:", randomCallCharge, "Admin:", adminShare, "Host:", hostEarnings);

        if (caller.coin >= randomCallCharge) {
          let agencyUpdate = null;
          if (receiver.agencyId) {
            console.log("🏢 Processing agency commission for random call");
            const agency = await Agency.findById(receiver.agencyId).lean().select("_id commissionType commission");

            if (agency) {
              if (agency.commissionType === 1) {
                // Percentage commission
                agencyShare = (hostEarnings * agency.commission) / 100;
                console.log("🏢 Agency percentage commission for random call:", agencyShare);
              } else {
                // Fixed salary, ignore earnings share
                agencyShare = 0;
                console.log("🏢 Agency fixed salary for random call, no commission");
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

          console.log("💾 Updating user and host coins, creating history for random call");
          await Promise.all([
            User.updateOne(
              { _id: caller._id, coin: { $gte: randomCallCharge } },
              {
                $inc: {
                  coin: -randomCallCharge,
                  spentCoins: randomCallCharge,
                },
              }
            ),
            Host.updateOne({ _id: receiver._id }, { $inc: { coin: hostEarnings } }),
            History.updateOne(
              { _id: callHistory._id, userId: caller._id, hostId: receiver._id },
              {
                $set: {
                  agencyId: receiver.agencyId,
                  date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
                },
                $inc: {
                  userCoin: randomCallCharge,
                  hostCoin: hostEarnings,
                  adminCoin: adminShare,
                  agencyCoin: Math.floor(agencyShare),
                },
              }
            ),
            agencyUpdate,
          ]);

          console.log("[callCoinCharged] Coin deduction and history update successful for random call.");
        } else {
          console.log(`[callCoinCharged] Insufficient Coins for Caller: ${caller._id}`);
          io.in("globalRoom:" + caller._id.toString()).emit("insufficientCoins", "You don't have sufficient coins.");
        }
      }
    } catch (error) {
      console.error("❌ [callCoinCharged] Error:", error);
    }
  });

  //random video call
  socket.on("ringingStarted", async (data) => {
    const parsedData = JSON.parse(data);
    const { callerId, receiverId, agoraUID, channel, gender } = parsedData;
    console.log("🎲 ringingStarted request received:", parsedData);

    console.log("🔧 Using hardcoded Agora settings for random call token");
    console.log("🔧 Agora App ID:", agoraSettings.agoraAppId);

    const role = RtcRole.PUBLISHER;
    const uid = agoraUID ? agoraUID : 0;
    const expirationTimeInSeconds = 24 * 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const [callUniqueId, token, caller, receiver] = await Promise.all([
      generateHistoryUniqueId(),
      RtcTokenBuilder.buildTokenWithUid(agoraSettings.agoraAppId, agoraSettings.agoraAppCertificate, channel, uid, role, privilegeExpiredTs),
      User.findById(callerId).select("_id name image isBlock isBusy callId isOnline uniqueId").lean(),
      Host.findById(receiverId).select("_id name image isBlock isBusy callId isOnline uniqueId").lean(),
    ]);

    console.log("🔍 Random call participants - Caller:", caller ? caller.name : "Not found");
    console.log("🔍 Random call participants - Receiver:", receiver ? receiver.name : "Not found");
    console.log("🎫 Random call token generated:", token ? "Success" : "Failed");

    if (!caller) {
      io.in("globalRoom:" + caller._id.toString()).emit("ringingStarted", { message: "Caller does not found." });
      return;
    }

    if (caller.isBlock) {
      io.in("globalRoom:" + caller._id.toString()).emit("ringingStarted", {
        message: "Caller is blocked.",
        isBlock: true,
      });
      return;
    }

    if (caller.isBusy && caller.callId) {
      io.in("globalRoom:" + caller._id.toString()).emit("ringingStarted", {
        message: "Caller is busy with someone else.",
        isBusy: true,
      });
      return;
    }

    if (!receiver) {
      io.in("globalRoom:" + caller._id.toString()).emit("ringingStarted", { message: "Receiver does not found." });
      return;
    }

    if (receiver.isBlock) {
      io.in("globalRoom:" + caller._id.toString()).emit("ringingStarted", {
        message: "Receiver is blocked.",
        isBlock: true,
      });
      return;
    }

    if (!receiver.isOnline) {
      io.in("globalRoom:" + caller._id.toString()).emit("ringingStarted", {
        message: "Receiver is not online.",
        isOnline: false,
      });
      return;
    }

    if (receiver.isBusy && receiver.callId) {
      io.in("globalRoom:" + caller._id.toString()).emit("ringingStarted", {
        message: "Receiver is busy with another call.",
        isBusy: true,
      });
      return;
    }

    if (!receiver.isBusy && receiver.callId === null) {
      console.log("✅ Receiver and Caller are free. Proceeding with call setup.");

      const callHistory = new History();
      callHistory.uniqueId = callUniqueId;
      callHistory.callId = callUniqueId;

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

      if (callerVerify.modifiedCount > 0 && receiverVerify.modifiedCount > 0) {
        const dataOfVideoCall = {
          callerId: caller._id,
          receiverId: receiver._id,
          callerImage: caller.image,
          callerName: caller.name,
          callerUniqueId: caller.uniqueId,
          receiverName: receiver.name,
          receiverImage: receiver.image,
          receiverUniqueId: receiver.uniqueId,
          callId: callHistory._id,
          callType: "video",
          callMode: "random",
          token,
          channel,
          gender: gender.trim().toLowerCase(),
        };

        io.in("globalRoom:" + receiver._id.toString()).emit("callIncoming", dataOfVideoCall); // Notify receiver
        io.in("globalRoom:" + caller._id.toString()).emit("callConnected", dataOfVideoCall); // Notify caller

        console.log(`Call successfully initiated: ${caller.name} → ${receiver.name}`);

        callHistory.type = 13;
        callHistory.callType = "video";
        callHistory.isRandom = true;
        callHistory.userId = caller._id;
        callHistory.hostId = receiver._id;
        callHistory.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        await Promise.all([
          callHistory.save(),
          Randomcall({
            caller: caller._id,
          }).save(),
        ]);
      } else {
        console.log("Failed to verify caller or receiver availability");

        io.in("globalRoom:" + caller._id.toString()).emit("ringingStarted", {
          message: "Call setup failed. One or both users became unavailable.",
          isBusy: true,
        });

        // Update isBusy only for the user who failed verification
        if (callerVerify.modifiedCount > 0) {
          await User.updateOne({ _id: callerId, isBusy: true }, { $set: { isBusy: false, callId: null } });
          console.log(`🔹 Caller Status Updated: Caller verification failed, isBusy reset`);
        }

        if (receiverVerify.modifiedCount > 0) {
          await User.updateOne({ _id: receiverId, isBusy: true }, { $set: { isBusy: false, callId: null } });
          console.log(`🔹 Receiver Status Updated: Receiver verification failed, isBusy reset`);
        }
        return;
      }
    } else {
      console.log("Condition not met - receiver not available");

      io.in("globalRoom:" + caller._id.toString()).emit("ringingStarted", {
        message: "Receiver is unavailable for a call at this moment.",
        isBusy: true,
      });
      return;
    }
  });

  //live-streaming
  socket.on("liveRoomJoin", async (data) => {
    const parsedData = JSON.parse(data);
    console.log("liveRoomJoin connected : ", parsedData);

    const sockets = await io.in(globalRoom).fetchSockets();

    if (sockets?.length) {
      sockets.forEach((socket) => {
        // Leave all previous liveHistoryId rooms dynamically
        socket.rooms.forEach((room) => {
          if (room !== globalRoom) {
            console.log(`Leaving old room: ${room}`);
            socket.leave(room);
          }
        });

        // Join the new live room
        socket.join(parsedData.liveHistoryId);
        console.log(`Joined new room: ${parsedData.liveHistoryId}`);
      });

      io.in(parsedData.liveHistoryId).emit("liveRoomJoin", data);
    } else {
      console.log("Sockets not able to emit");
    }
  });

  socket.on("liveStreamStatusCheck", async (data) => {
    try {
      const dataOfCheck = JSON.parse(data);
      console.log("[liveStreamStatusCheck] Parsed data:", dataOfCheck);

      const { liveHistoryId, hostId } = dataOfCheck;

      const liveUser = await LiveBroadcaster.findOne({ hostId: hostId, liveHistoryId: liveHistoryId }).lean();

      if (!liveUser) {
        console.log(`[liveStreamStatusCheck] User ${hostId} is not live.`);

        const targetSocket = io.sockets.sockets.get(socket.id);
        if (targetSocket) {
          console.log("Target socket exists, emitting...");
          targetSocket.emit("liveStreamStatusCheck", { hostId, liveStatus: false });
        } else {
          console.log("Target socket not found.");
        }
        return;
      }

      console.log(`[liveStreamStatusCheck] User ${hostId} is live.`);

      const targetSocket = io.sockets.sockets.get(socket.id);
      if (targetSocket) {
        console.log("Target socket exists, emitting...");
        targetSocket.emit("liveStreamStatusCheck", { hostId, liveStatus: true });
      } else {
        console.log("Target socket not found.");
      }
    } catch (error) {
      console.error("[liveStreamStatusCheck] Error:", error);
      socket.emit("liveStreamStatusCheck", { hostId: dataOfCheck.hostId, liveStatus: false });
    }
  });

  socket.on("liveJoinerCount", async (data) => {
    const dataOfaddView = JSON.parse(data);
    console.log("[liveJoinerCount] Received data:", dataOfaddView);

    const { userId, liveHistoryId } = dataOfaddView;

    const [user, liveUser, existLiveView] = await Promise.all([
      User.findById(userId).select("_id name image gender countryFlagImage country").lean(),
      LiveBroadcaster.findOne({ liveHistoryId }).select("view").lean(),
      LiveBroadcastView.findOne({ userId, liveHistoryId }).lean(),
    ]);

    if (!user) {
      console.log(`[liveJoinerCount] User not found.`);
      return;
    }

    if (!liveUser) {
      console.log(`[liveJoinerCount] LiveUser not found.`);
      return;
    }

    if (!socket.rooms.has(liveHistoryId)) {
      socket.join(liveHistoryId.toString());
      console.log(`[liveJoinerCount] joined room: ${liveHistoryId}`);
    } else {
      console.log(`[liveJoinerCount] User is already in room: ${liveHistoryId}`);
    }

    if (!existLiveView) {
      console.log("[liveJoinerCount] Creating new LiveView entry");

      await LiveBroadcastView.create({
        userId,
        liveHistoryId,
        ...user,
      });
    }

    const totalViews = await LiveBroadcastView.countDocuments({ liveHistoryId });
    console.log(`[liveJoinerCount] Total viewers for ${liveHistoryId}:`, totalViews);

    io.in(liveHistoryId).emit("liveJoinerCount", totalViews);

    await Promise.all([
      LiveBroadcaster.updateOne(
        { _id: liveUser?._id },
        {
          $set: { view: totalViews },
        }
      ),
      LiveBroadcastHistory.updateOne(
        { _id: liveHistoryId },
        {
          $set: { audienceCount: totalViews },
        }
      ),
    ]);
  });

  socket.on("removeLiveJoiner", async (data) => {
    try {
      const dataOflessView = JSON.parse(data);
      console.log("[removeLiveJoiner] Received data:", dataOflessView);

      const { userId, liveHistoryId } = dataOflessView;

      const [liveUser, existLiveView] = await Promise.all([LiveBroadcaster.findOne({ liveHistoryId }).select("_id view").lean(), LiveBroadcastView.findOne({ userId, liveHistoryId }).lean()]);

      if (!liveUser) {
        console.log(`[removeLiveJoiner] LiveUser not found.`);
        return;
      }

      if (existLiveView) {
        console.log("[removeLiveJoiner] Removing user from LiveView");
        await LiveBroadcastView.deleteOne({ _id: existLiveView._id });
      }

      const totalViews = await LiveBroadcastView.countDocuments({ liveHistoryId });
      console.log(`[removeLiveJoiner] Updated total viewers for ${liveHistoryId}:`, totalViews);

      io.in(liveHistoryId).emit("removeLiveJoiner", totalViews);

      await LiveBroadcaster.updateOne({ _id: liveUser._id }, { $set: { view: totalViews } });

      if (!socket.rooms.has(liveHistoryId)) {
        socket.leave(liveHistoryId);
        console.log(`[removeLiveJoiner] joined room: ${liveHistoryId}`);
      } else {
        console.log(`[removeLiveJoiner] User is already in room: ${liveHistoryId}`);
      }
    } catch (error) {
      console.error("[removeLiveJoiner] Error:", error);
    }
  });

  socket.on("liveCommentBroadcast", async (data) => {
    try {
      const dataOfComment = JSON.parse(data);
      console.log("[liveCommentBroadcast] Parsed data:", dataOfComment);

      const { liveHistoryId } = dataOfComment;

      if (!socket.rooms.has(liveHistoryId)) {
        socket.join(liveHistoryId.toString());
        console.log(`[liveCommentBroadcast] joined room: ${liveHistoryId}`);
      } else {
        console.log(`[liveCommentBroadcast] User is already in room: ${liveHistoryId}`);
      }

      const [liveHistory] = await Promise.all([LiveBroadcastHistory.findById(liveHistoryId).select("_id").lean()]);

      io.in(liveHistoryId).emit("liveCommentBroadcast", data);

      const socketCount = (await io.in(liveHistoryId).fetchSockets())?.length || 0;
      console.log(`[liveCommentBroadcast] Active sockets in room ${liveHistoryId}:`, socketCount);

      if (liveHistory) {
        await LiveBroadcastHistory.updateOne({ _id: liveHistory._id }, { $inc: { liveComments: 1 } });
      }
    } catch (error) {
      console.error("[liveCommentBroadcast] Error:", error);
    }
  });

  socket.on("liveGiftSent", async (data) => {
    const giftData = JSON.parse(data);
    console.log("🎁 Live Gift Data Received:", giftData);

    if (!socket.rooms.has(giftData.liveHistoryId)) {
      socket.join(giftData.liveHistoryId.toString());
      console.log(`[liveGiftSent] joined room: ${giftData.liveHistoryId}`);
    } else {
      console.log(`[liveGiftSent] User is already in room: ${giftData.liveHistoryId}`);
    }

    try {
      const [uniqueId, senderUser, receiver, gift] = await Promise.all([
        generateHistoryUniqueId(),
        User.findById(giftData.senderId).lean().select("_id coin"),
        Host.findById(giftData.receiverId).lean().select("_id coin totalGifts agencyId"),
        Gift.findById(giftData.giftId).lean().select("_id coin type"),
      ]);

      if (!senderUser) {
        console.log("Sender user not found");
        io.in(`globalRoom:${giftData.senderUserId}`).emit("liveGiftReceived", { error: "Sender user not found" });
        return;
      }

      if (!receiver) {
        console.log("Receiver user not found");
        io.in(`globalRoom:${giftData.receiverId}`).emit("liveGiftReceived", { error: "Receiver user not found" });
        return;
      }

      if (!gift) {
        console.log("Gift not found");
        io.in(`globalRoom:${giftData.senderUserId}`).emit("liveGiftReceived", { error: "Gift not found" });
        return;
      }

      const giftCount = Number(giftData.giftCount);
      const coinPerGift = Math.abs(gift.coin);
      const totalCoin = coinPerGift * giftCount;

      if (senderUser.coin < totalCoin) {
        console.log("Insufficient coins");
        io.in(`globalRoom:${giftData.senderUserId}`).emit("liveGiftReceived", { error: "You don't have enough coins" });
        return;
      }

      io.in(giftData.liveHistoryId).emit("liveGiftReceived", giftData);

      console.log("💰 Using hardcoded admin commission rate for live gifts:", agoraSettings.adminCommissionRate);
      
      const adminCommissionRate = agoraSettings.adminCommissionRate;
      let adminShare = (totalCoin * adminCommissionRate) / 100;
      let hostEarnings = totalCoin - adminShare;
      let agencyShare = 0;

      console.log("🎁 Live gift economics - Total:", totalCoin, "Admin:", adminShare, "Host:", hostEarnings);

      let agencyUpdate = null;
      if (receiver.agencyId) {
        const agency = await Agency.findById(receiver.agencyId).lean().select("_id commissionType commission");

        if (agency) {
          if (agency.commissionType === 1) {
            // Percentage commission
            agencyShare = (hostEarnings * agency.commission) / 100;
            console.log("🏢 Agency percentage commission for live gift:", agencyShare);
          } else {
            // Fixed salary, ignore earnings share
            agencyShare = 0;
            console.log("🏢 Agency fixed salary for live gift, no commission");
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
          { _id: senderUser._id, coin: { $gte: totalCoin } },
          {
            $inc: {
              coin: -totalCoin,
              spentCoins: totalCoin,
            },
          }
        ),
        Host.updateOne({ _id: receiver._id }, { $inc: { coin: hostEarnings, totalGifts: 1 } }),
        History.create({
          uniqueId: uniqueId,
          type: 2,
          userId: senderUser._id,
          hostId: receiver._id,
          agencyId: receiver?.agencyId,
          giftId: giftData.giftId,
          giftCoin: gift.coin || 0,
          giftImage: gift.image || "",
          giftType: gift.type || 1,
          giftCount: giftCount,
          userCoin: totalCoin,
          hostCoin: hostEarnings,
          adminCoin: adminShare,
          agencyCoin: Math.floor(agencyShare),
          date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        }),
        agencyUpdate,
        LiveBroadcastHistory.findByIdAndUpdate(
          giftData.liveHistoryId,
          {
            $inc: {
              coins: totalCoin,
              gifts: giftCount,
            },
          },
          { new: true }
        ),
      ]);
    } catch (error) {
      console.error("❌ Error in liveGiftSent:", error);
      io.in(giftData.liveHistoryId).emit("liveGiftReceived", { error: "An error occurred while processing the gift." });
      return;
    }
  });

  socket.on("liveStreamEnd", async (data) => {
    try {
      const parsedData = JSON.parse(data);
      console.log("Received liveStreamEnd event with data:", parsedData);

      const { hostId, liveHistoryId } = parsedData;

      io.in(liveHistoryId).emit("liveStreamEnd", data);

      const [host, liveUser, liveHistory] = await Promise.all([
        Host.findOne({ liveHistoryId }).select("_id isLive isBusy liveHistoryId").lean(),
        LiveBroadcaster.findOne({ hostId, liveHistoryId }).select("_id hostId liveHistoryId isAudio").lean(),
        LiveBroadcastHistory.findById(liveHistoryId).select("_id startTime endTime duration").lean(),
      ]);

      if (!host) {
        console.log("⚠️ Host not found.");
        return;
      }

      if (!liveUser) {
        console.log(`⚠️ No LiveUser found with hostId: ${hostId} and liveHistoryId: ${liveHistoryId}`);
        return;
      }

      if (!liveHistory) {
        console.log("⚠️ LiveHistory not found.");
        return;
      }

      if (host.isLive) {
        const endTime = moment().tz("Asia/Kolkata").format();
        const start = moment.tz(liveHistory.startTime, "Asia/Kolkata");
        const end = moment.tz(endTime, "Asia/Kolkata");
        const duration = moment.utc(end.diff(start)).format("HH:mm:ss");

        await Promise.all([
          LiveBroadcastHistory.updateOne({ _id: liveHistory._id }, { $set: { endTime, duration } }),
          Host.updateOne({ _id: host._id }, { $set: { isLive: false, isBusy: false, liveHistoryId: null } }),
          LiveBroadcastView.deleteMany({ liveHistoryId }),
          LiveBroadcaster.deleteOne({ hostId, liveHistoryId }),
        ]);

        console.log(`✅ Host is no longer live.`);
        console.log("✅ Related liveViews deleted.");
        console.log(`✅ LiveBroadcaster entry deleted for hostId: ${hostId}`);
      }

      const sockets = await io.in(liveHistoryId).fetchSockets();
      console.log(`🔄 Active sockets in room (${liveHistoryId}): ${sockets.length}`);

      if (sockets.length) {
        io.socketsLeave(liveHistoryId);
        console.log(`✅ All sockets removed from room: ${liveHistoryId}`);
      } else {
        console.log("⚠️ No active sockets found to remove.");
      }
    } catch (error) {
      console.error("❌ Error in liveStreamEnd:", error);
    }
  });

  socket.on("disconnect", async (reason) => {
    console.log(`🔌 Socket disconnected: ${id} - ${socket.id} - Reason: ${reason}`);
    console.log("🔍 Processing disconnect cleanup for user/host:", id);

    if (globalRoom) {
      const sockets = await io.in(globalRoom).fetchSockets();
      console.log("🔄 Checking active sockets in room:", sockets.length);

      if (sockets?.length == 0) {
        const personId = new mongoose.Types.ObjectId(id);
        console.log(`🔍 Fetching data for disconnected user Id: ${personId}`);

        const host = await Host.findById(personId).select("_id callId isLive liveHistoryId").lean();
        if (host) {
          console.log("🎭 Host disconnect cleanup starting");
          
          if (host.callId && host.callId !== null) {
            console.log(`📞 Host was in active call ${host.callId}, cleaning up`);
            io.socketsLeave(host.callId.toString());

            const [callHistory] = await Promise.all([
              History.findById(callId).select("_id callStartTime"),
              Privatecall.deleteOne({ receiver: personId }),
              Host.updateOne({ _id: personId }, { $set: { isOnline: false, isBusy: false, isLive: false, callId: null, liveHistoryId: null } }),
            ]);

            if (callHistory) {
              callHistory.callConnect = false;
              callHistory.callEndTime = moment().tz("Asia/Kolkata").format();

              const start = moment.tz(callHistory.callStartTime, "Asia/Kolkata");
              const end = moment.tz(callHistory.callEndTime, "Asia/Kolkata");
              const duration = moment.utc(end.diff(start)).format("HH:mm:ss");
              callHistory.duration = duration;

              await Promise.all([
                callHistory?.save(),
                Chat.findOneAndUpdate(
                  { callId: callHistory._id },
                  {
                    $set: {
                      callDuration: duration,
                      callType: 1, // 1 = Received Call
                      isRead: true,
                    },
                  },
                  { new: true }
                ),
              ]);
            }
          }

          if (host.isLive && host.liveHistoryId) {
            console.log(`📺 Host was live streaming ${host.liveHistoryId}, ending stream`);
            const liveHistory = await LiveBroadcastHistory.findById(host.liveHistoryId).select("startTime").lean();

            const endTime = moment().tz("Asia/Kolkata").format();
            const start = moment.tz(liveHistory.startTime, "Asia/Kolkata");
            const end = moment.tz(endTime, "Asia/Kolkata");
            const duration = moment.utc(end.diff(start)).format("HH:mm:ss");

            await Promise.all([
              LiveBroadcastHistory.updateOne({ _id: liveHistory._id }, { $set: { endTime, duration } }),
              Host.updateOne({ _id: host._id }, { $set: { isLive: false, isBusy: false, liveHistoryId: null } }),
              LiveBroadcastView.deleteMany({ liveHistoryId: host.liveHistoryId }),
              LiveBroadcaster.deleteOne({ hostId: personId, liveHistoryId: host.liveHistoryId }),
            ]);

            console.log(`✅ Host is no longer live.`);
            console.log("✅ Related liveViews deleted.");
            console.log(`✅ LiveBroadcaster entry deleted`);
          }

          await Host.updateOne(
            { _id: host._id },
            {
              $set: {
                isOnline: false,
                isBusy: false,
                isLive: false,
                liveHistoryId: null,
                callId: null,
              },
            }
          );
        } else {
          const user = await User.findById(personId).select("_id callId").lean();

          if (user) {
            console.log("👤 User disconnect cleanup starting");
            
            if (user.callId && user.callId !== null) {
              console.log(`📞 User was in active call ${user.callId}, cleaning up`);
              io.socketsLeave(user.callId.toString());

              const [callHistory] = await Promise.all([
                History.findById(callId).select("_id callStartTime"),
                Privatecall.deleteOne({ caller: personId }),
                User.updateOne(
                  { _id: personId },
                  {
                    $set: {
                      isOnline: false,
                      isBusy: false,
                      isLive: false,
                      callId: null,
                      liveHistoryId: null,
                    },
                  }
                ),
              ]);

              if (callHistory) {
                callHistory.callConnect = false;
                callHistory.callEndTime = moment().tz("Asia/Kolkata").format();

                const start = moment.tz(callHistory.callStartTime, "Asia/Kolkata");
                const end = moment.tz(callHistory.callEndTime, "Asia/Kolkata");
                const duration = moment.utc(end.diff(start)).format("HH:mm:ss");
                callHistory.duration = duration;

                await Promise.all([
                  callHistory?.save(),
                  Chat.updateOne(
                    { callId: callHistory._id },
                    {
                      $set: {
                        callDuration: duration,
                        callType: 1, // 1 = Received Call
                        isRead: true,
                      },
                    }
                  ),
                ]);
              }
            }

            await User.updateOne(
              { _id: user._id },
              {
                $set: {
                  isOnline: false,
                  isBusy: false,
                  isLive: false,
                  liveHistoryId: null,
                  callId: null,
                },
              }
            );
          }
        }
      }
    }
  });
});
