const mongoose = require("mongoose");

const { MESSAGE_TYPE, CALL_TYPE } = require("../types/constant");

const chatSchema = mongoose.Schema(
  {
    chatTopicId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatTopic", default: null },
    senderId: { type: mongoose.Schema.Types.ObjectId, default: null },
    messageType: { type: Number, enum: MESSAGE_TYPE }, //1.message 2.image 3.audio 4.gift 5.audio_call 6.video_call
    message: { type: String, default: "" },
    image: { type: String, default: "" },
    audio: { type: String, default: "" },
    giftType: { type: Number, default: 0 },
    giftCount: { type: Number, default: 0 },

    isRead: { type: Boolean, default: false },

    callId: { type: mongoose.Schema.Types.ObjectId, default: null },
    callType: { type: Number, enum: CALL_TYPE }, //1.received 2.declined 3.missCalled
    callDuration: { type: String, default: "" },

    date: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

chatSchema.index({ chatTopicId: 1 });
chatSchema.index({ senderId: 1 });

module.exports = mongoose.model("Chat", chatSchema);
