const mongoose = require("mongoose");

const privatecallSchema = new mongoose.Schema(
  {
    caller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "Host" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

privatecallSchema.index({ caller: 1 });
privatecallSchema.index({ receiver: 1 });

module.exports = mongoose.model("Privatecall", privatecallSchema);
