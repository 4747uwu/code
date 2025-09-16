const VipPlan = require("../../models/vipPlan.model");

//create a new VIP plan
exports.createVipPlan = async (req, res) => {
  try {
    const { validity, validityType, coin, price } = req.body;
    if (!validity || !validityType || !coin || !price) {
      return res.status(200).json({ status: false, message: "Invalid details provided." });
    }

    const vipPlan = new VipPlan({ validity, validityType, coin, price });
    await vipPlan.save();

    return res.status(200).json({ status: true, message: "VIP plan created successfully.", data: vipPlan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//update an existing VIP plan
exports.updateVipPlan = async (req, res) => {
  try {
    const { vipPlanId } = req.body;
    if (!vipPlanId) {
      return res.status(200).json({ status: false, message: "vipPlanId is required." });
    }

    const vipPlan = await VipPlan.findById(vipPlanId).lean();
    if (!vipPlan) {
      return res.status(200).json({ status: false, message: "VIP Plan not found." });
    }

    const updateFields = {
      validity: req.body.validity !== undefined ? Number(req.body.validity) : vipPlan.validity,
      validityType: req.body.validityType || vipPlan.validityType,
      coin: req.body.coin !== undefined ? Number(req.body.coin) : vipPlan.coin,
      price: req.body.price !== undefined ? Number(req.body.price) : vipPlan.price,
    };

    const updatedVipPlan = await VipPlan.findByIdAndUpdate(vipPlanId, updateFields, { new: true, lean: true });
    return res.status(200).json({ status: true, message: "VIP plan updated successfully.", data: updatedVipPlan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//toggle VIP plan status (isActive)
exports.toggleVipPlanStatus = async (req, res) => {
  try {
    const { vipPlanId } = req.query;
    if (!vipPlanId) {
      return res.status(200).json({ status: false, message: "Valid vipPlanId is required." });
    }

    const vipPlan = await VipPlan.findById(vipPlanId).select("isActive").lean();
    if (!vipPlan) {
      return res.status(200).json({ status: false, message: "VIP Plan not found." });
    }

    const updatedVipPlan = await VipPlan.findByIdAndUpdate(vipPlanId, { isActive: !vipPlan.isActive }, { new: true }).lean();
    return res.status(200).json({ status: true, message: "VIP plan status updated successfully.", data: updatedVipPlan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//delete a VIP plan
exports.deleteVipPlan = async (req, res) => {
  try {
    const { vipPlanId } = req.query;
    if (!vipPlanId) {
      return res.status(200).json({ status: false, message: "vipPlanId is required." });
    }

    const vipPlan = await VipPlan.findById(vipPlanId).select("_id").lean();
    if (!vipPlan) {
      return res.status(200).json({ status: false, message: "VIP Plan not found." });
    }

    await VipPlan.deleteOne({ _id: vipPlanId });
    return res.status(200).json({ status: true, message: "VIP plan deleted successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//retrieve all VIP plans
exports.getVipPlans = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const vipPlans = await VipPlan.find()
      .select("validity validityType coin price isActive")
      .sort({ coin: 1, price: 1 })
      .skip((start - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({ status: true, message: "VIP plans retrieved successfully.", data: vipPlans });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
