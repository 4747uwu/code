const VipPlanPrivilege = require("../../models/vipPlanPrivilege.model");

//get VIP Plan Privilege
exports.retrieveVipPrivilege = async (req, res) => {
  try {
    const privilege = await VipPlanPrivilege.findOne().select("vipFrameBadge audioCallDiscount videoCallDiscount randomMatchCallDiscount topUpCoinBonus freeMessages").lean();

    return res.status(200).json({
      status: true,
      message: "Retrieved VIP privilege successfully.",
      data: privilege || null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
