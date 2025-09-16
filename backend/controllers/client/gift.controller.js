const Gift = require("../../models/gift.model");
const GiftCategory = require("../../models/giftCategory.model");

//get gifts grouped by category
exports.fetchGiftList = async (req, res, next) => {
  try {
    let { giftCategoryId } = req.query;

    if (!giftCategoryId) {
      return res.status(200).json({ status: false, message: "giftCategoryId query param is required." });
    }

    const [giftCategory, gifts] = await Promise.all([
      GiftCategory.findById(giftCategoryId),
      Gift.find({ giftCategoryId: giftCategoryId, isDelete: false }).select("title type image coin").sort({ createdAt: -1 }).lean(),
    ]);

    if (!giftCategory) {
      return res.status(200).json({ status: false, message: "Gift category not found." });
    }

    return res.status(200).json({ status: true, message: "Gifts retrieved successfully.", data: gifts });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};
