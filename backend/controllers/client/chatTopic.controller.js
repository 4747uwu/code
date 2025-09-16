const ChatTopic = require("../../models/chatTopic.model");

//mongoose
const mongoose = require("mongoose");

//get chat thumb list ( user )
exports.fetchChatList = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const [chatList] = await Promise.all([
      ChatTopic.aggregate([
        {
          $match: {
            chatId: { $ne: null },
            $or: [{ senderId: userObjectId }, { receiverId: userObjectId }],
          },
        },
        {
          $addFields: {
            receiverId: {
              $cond: {
                if: { $eq: ["$senderId", userObjectId] },
                then: "$receiverId",
                else: "$senderId",
              },
            },
          },
        },
        {
          $lookup: {
            from: "blocks",
            let: { receiverId: "$receiverId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      {
                        $and: [{ $eq: ["$userId", userObjectId] }, { $eq: ["$hostId", "$$receiverId"] }],
                      },
                      {
                        $and: [{ $eq: ["$userId", "$$receiverId"] }, { $eq: ["$hostId", userObjectId] }],
                      },
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
            blockInfo: { $eq: [] }, // Exclude both user-blocked-host and host-blocked-user
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "receiverId",
            foreignField: "_id",
            as: "host",
          },
        },
        { $unwind: { path: "$host", preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: "chats",
            localField: "chatId",
            foreignField: "_id",
            as: "chat",
          },
        },
        { $unwind: { path: "$chat", preserveNullAndEmptyArrays: false } },
        { $sort: { "chat.createdAt": -1 } },
        {
          $group: {
            _id: "$_id",
            receiverId: { $first: "$receiverId" },
            name: { $first: "$host.name" },
            image: { $first: "$host.image" },
            isOnline: { $first: "$host.isOnline" },
            chatTopic: { $first: "$chat.chatTopicId" },
            senderId: { $first: "$chat.senderId" },
            messageType: { $first: "$chat.messageType" },
            message: { $first: "$chat.message" },
            isRead: { $first: "$chat.isRead" },
            lastChatMessageTime: { $first: "$chat.createdAt" },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [{ $ne: ["$chat.senderId", userObjectId] }, { $eq: ["$chat.isRead", false] }],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            receiverId: 1,
            name: 1,
            image: 1,
            isOnline: 1,
            chatTopic: 1,
            senderId: 1,
            messageType: 1,
            message: 1,
            unreadCount: 1,
            lastChatMessageTime: 1,
            time: {
              $let: {
                vars: {
                  messageDay: {
                    $dateToString: { format: "%Y-%m-%d", date: "$lastChatMessageTime" },
                  },
                  today: {
                    $dateToString: { format: "%Y-%m-%d", date: new Date() },
                  },
                  yesterday: {
                    $dateToString: { format: "%Y-%m-%d", date: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                  },
                  dayOfWeek: {
                    $dayOfWeek: "$lastChatMessageTime",
                  },
                },
                in: {
                  $cond: [
                    { $eq: ["$$messageDay", "$$today"] },
                    "Today",
                    {
                      $cond: [
                        { $eq: ["$$messageDay", "$$yesterday"] },
                        "Yesterday",
                        {
                          $switch: {
                            branches: [
                              { case: { $eq: ["$$dayOfWeek", 1] }, then: "Sunday" },
                              { case: { $eq: ["$$dayOfWeek", 2] }, then: "Monday" },
                              { case: { $eq: ["$$dayOfWeek", 3] }, then: "Tuesday" },
                              { case: { $eq: ["$$dayOfWeek", 4] }, then: "Wednesday" },
                              { case: { $eq: ["$$dayOfWeek", 5] }, then: "Thursday" },
                              { case: { $eq: ["$$dayOfWeek", 6] }, then: "Friday" },
                              { case: { $eq: ["$$dayOfWeek", 7] }, then: "Saturday" },
                            ],
                            default: "Unknown day",
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        { $sort: { lastChatMessageTime: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    return res.status(200).json({ status: true, message: "Success", chatList });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get chat thumb list ( host )
exports.retrieveChatList = async (req, res) => {
  try {
    if (!req.query.hostId || !mongoose.Types.ObjectId.isValid(req.query.hostId)) {
      return res.status(200).json({ status: false, message: "Invalid or missing hostId." });
    }

    const hostObjectId = new mongoose.Types.ObjectId(req.query.hostId);
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const [chatList] = await Promise.all([
      ChatTopic.aggregate([
        {
          $match: {
            chatId: { $ne: null },
            $or: [{ senderId: hostObjectId }, { receiverId: hostObjectId }],
          },
        },
        {
          $addFields: {
            userId: {
              $cond: {
                if: { $eq: ["$senderId", hostObjectId] },
                then: "$receiverId",
                else: "$senderId",
              },
            },
          },
        },
        {
          $lookup: {
            from: "blocks",
            let: { userId: "$userId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      {
                        $and: [{ $eq: ["$hostId", hostObjectId] }, { $eq: ["$userId", "$$userId"] }],
                      },
                      {
                        $and: [{ $eq: ["$userId", hostObjectId] }, { $eq: ["$hostId", "$$userId"] }],
                      },
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
            blockInfo: { $eq: [] }, // Exclude if any block exists between host and user
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: "chats",
            localField: "chatId",
            foreignField: "_id",
            as: "chat",
          },
        },
        { $unwind: { path: "$chat", preserveNullAndEmptyArrays: false } },
        { $sort: { "chat.createdAt": -1 } },
        {
          $group: {
            _id: "$userId",
            userId: { $first: "$userId" },
            name: { $first: "$user.name" },
            image: { $first: "$user.image" },
            isOnline: { $first: "$user.isOnline" },
            isRead: { $first: "$chat.isRead" },
            chatTopic: { $first: "$chat.chatTopicId" },
            senderId: { $first: "$chat.senderId" },
            message: { $first: "$chat.message" },
            messageType: { $first: "$chat.messageType" },
            lastChatMessageTime: { $first: "$chat.createdAt" },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [{ $ne: ["$chat.senderId", hostObjectId] }, { $eq: ["$chat.isRead", false] }],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            userId: 1,
            name: 1,
            image: 1,
            isOnline: 1,
            chatTopic: 1,
            senderId: 1,
            messageType: 1,
            message: 1,
            unreadCount: 1,
            lastChatMessageTime: 1,
            time: {
              $let: {
                vars: {
                  messageDay: {
                    $dateToString: { format: "%Y-%m-%d", date: "$lastChatMessageTime" },
                  },
                  today: {
                    $dateToString: { format: "%Y-%m-%d", date: new Date() },
                  },
                  yesterday: {
                    $dateToString: { format: "%Y-%m-%d", date: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                  },
                  dayOfWeek: {
                    $dayOfWeek: "$lastChatMessageTime",
                  },
                },
                in: {
                  $cond: [
                    { $eq: ["$$messageDay", "$$today"] },
                    "Today",
                    {
                      $cond: [
                        { $eq: ["$$messageDay", "$$yesterday"] },
                        "Yesterday",
                        {
                          $switch: {
                            branches: [
                              { case: { $eq: ["$$dayOfWeek", 1] }, then: "Sunday" },
                              { case: { $eq: ["$$dayOfWeek", 2] }, then: "Monday" },
                              { case: { $eq: ["$$dayOfWeek", 3] }, then: "Tuesday" },
                              { case: { $eq: ["$$dayOfWeek", 4] }, then: "Wednesday" },
                              { case: { $eq: ["$$dayOfWeek", 5] }, then: "Thursday" },
                              { case: { $eq: ["$$dayOfWeek", 6] }, then: "Friday" },
                              { case: { $eq: ["$$dayOfWeek", 7] }, then: "Saturday" },
                            ],
                            default: "Unknown day",
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        { $sort: { lastChatMessageTime: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    return res.status(200).json({ status: true, message: "Success", chatList });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
