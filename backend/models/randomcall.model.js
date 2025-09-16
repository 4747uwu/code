const mongoose = require("mongoose");

const randomcallSchema = new mongoose.Schema(
  {
    caller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

randomcallSchema.index({ caller: 1 });

module.exports = mongoose.model("Randomcall", randomcallSchema);
