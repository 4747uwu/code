const GiftCategory = require("../../models/giftCategory.model");

//retrieve all giftCategories
exports.listGiftCategories = async (req, res) => {
  try {
    const categories = await GiftCategory.find({ isDelete: false }).select("_id name ").lean();

    return res.status(200).json({
      status: true,
      message: "Gift categories retrieved successfully.",
      data: categories,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
