const GiftCategory = require("../../models/giftCategory.model");
const Gift = require("../../models/gift.model");

//create giftCategory
exports.createGiftCategory = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(200).json({ status: false, message: "Category name is required." });
    }

    const category = new GiftCategory({ name });
    await category.save();

    return res.status(200).json({
      status: true,
      message: "Gift category created successfully.",
      data: category,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//update giftCategory
exports.updateGiftCategory = async (req, res) => {
  try {
    const { categoryId, name } = req.query;

    if (!categoryId || !name) {
      return res.status(200).json({ status: false, message: "Category ID and name are required." });
    }

    const updatedCategory = await GiftCategory.findByIdAndUpdate(categoryId, { name }, { new: true, select: "_id name createdAt updatedAt" }).lean();

    if (!updatedCategory) {
      return res.status(200).json({ status: false, message: "Gift category not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Gift category updated successfully.",
      data: updatedCategory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//retrieve all giftCategories
exports.getAllGiftCategories = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const [total, categories] = await Promise.all([
      GiftCategory.countDocuments({ isDelete: false }),
      GiftCategory.find({ isDelete: false })
        .select("_id name createdAt updatedAt")
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "Gift categories retrieved successfully.",
      total,
      data: categories,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//retrieve all giftCategories ( drop-down )
exports.listGiftCategories = async (req, res) => {
  try {
    const [categories] = await Promise.all([GiftCategory.find({ isDelete: false }).select("_id name createdAt").lean()]);

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

//delete giftCategory
exports.deleteGiftCategory = async (req, res) => {
  try {
    const { categoryId } = req.query;
    if (!categoryId) {
      return res.status(200).json({ status: false, message: "Category ID is required." });
    }

    const updatedCategory = await GiftCategory.findById(categoryId).select("_id").lean();

    if (!updatedCategory) {
      return res.status(200).json({ status: false, message: "Gift category not found." });
    }

    res.status(200).json({
      status: true,
      message: "Gift category marked as deleted successfully.",
    });

    //await Promise.all([GiftCategory.findByIdAndUpdate(categoryId, { isDelete: true }), Gift.updateMany({ giftCategoryId: categoryId }, { $set: { isDelete: true } })]);
    await Promise.all([GiftCategory.findByIdAndDelete(categoryId), Gift.deleteMany({ giftCategoryId: categoryId })]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
