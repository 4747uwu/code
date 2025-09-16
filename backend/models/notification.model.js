const mongoose = require("mongoose");

const { NOTIFICATION_PERSON_TYPE } = require("../types/constant");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "Host" },
    notificationPersonType: { type: Number, enum: NOTIFICATION_PERSON_TYPE }, //1.user 2.host
    title: { type: String, default: "" },
    message: { type: String, default: "" },
    image: { type: String, default: "" },
    date: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ user: 1 });
notificationSchema.index({ host: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
