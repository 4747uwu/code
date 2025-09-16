const VipPlanPrivilege = require("../../models/vipPlanPrivilege.model");

//deletefile
const { deleteFile } = require("../../util/deletefile");

//fs
const fs = require("fs");

//update VIP Plan Privilege
exports.modifyVipPrivilege = async (req, res) => {
  try {
    let privilege = await VipPlanPrivilege.findOne();

    if (!privilege) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "No existing VIP privilege found." });
    }

    if (req.file) {
      if (privilege.vipFrameBadge) {
        const oldBadgePath = privilege.vipFrameBadge.split("storage");
        if (oldBadgePath.length > 1 && fs.existsSync("storage" + oldBadgePath[1])) {
          fs.unlinkSync("storage" + oldBadgePath[1]);
        }
      }
      privilege.vipFrameBadge = req.file.path;
    }

    privilege.audioCallDiscount = req.body.audioCallDiscount ?? privilege.audioCallDiscount;
    privilege.videoCallDiscount = req.body.videoCallDiscount ?? privilege.videoCallDiscount;
    privilege.randomMatchCallDiscount = req.body.randomMatchCallDiscount ?? privilege.randomMatchCallDiscount;
    privilege.topUpCoinBonus = req.body.topUpCoinBonus ?? privilege.topUpCoinBonus;
    privilege.freeMessages = req.body.freeMessages ?? privilege.freeMessages;

    await privilege.save();

    return res.status(200).json({
      status: true,
      message: "VIP privilege has been updated.",
      data: privilege,
    });
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get VIP Plan Privilege
exports.retrieveVipPrivilege = async (req, res) => {
  try {
    const privilege = await VipPlanPrivilege.findOne().select("vipFrameBadge audioCallDiscount videoCallDiscount randomMatchCallDiscount topUpCoinBonus freeMessages createdAt").lean();

    return res.status(200).json({
      status: true,
      message: "Retrieved VIP privilege successfully.",
      data: privilege,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
