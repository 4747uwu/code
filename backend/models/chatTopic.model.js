const mongoose = require("mongoose");

const chatTopicSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, default: null },
    receiverId: { type: mongoose.Schema.Types.ObjectId, default: null },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", default: null },
    messageCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

chatTopicSchema.index({ senderId: 1, receiverId: 1 });
chatTopicSchema.index({ chatId: 1 });

module.exports = mongoose.model("ChatTopic", chatTopicSchema);
