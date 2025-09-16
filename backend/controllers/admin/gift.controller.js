const Gift = require("../../models/gift.model");
const GiftCategory = require("../../models/giftCategory.model");

//fs
const fs = require("fs");

//deletefile
const { deleteFiles } = require("../../util/deletefile");

//create gift
exports.addGift = async (req, res, next) => {
  try {
    const { type, giftCategoryId, coin } = req.body;

    if (!type || !giftCategoryId || !coin) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops! Invalid details." });
    }

    const [giftCategory] = await Promise.all([GiftCategory.findById(giftCategoryId).select("_id name")]);

    if (!giftCategory) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "GiftCategory does not exist." });
    }

    const giftData = {
      type,
      giftCategoryId,
      coin: coin,
      image: req.files?.image ? req.files.image[0].path : "",
      svgaImage: type == 3 && req.files?.svgaImage ? req.files.svgaImage[0].path : "",
      filename: req.files?.image ? req.files?.image[0].filename : "",
    };

    const gift = new Gift(giftData);
    await gift.save();

    return res.status(200).json({ status: true, message: "Gift has been created by the admin.", data: { ...gift.toObject(), giftCategory } });
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//update gift
exports.modifyGift = async (req, res, next) => {
  try {
    const { giftId } = req.query;
    const { giftCategoryId } = req.body;

    if (!giftId) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "giftId must be required." });
    }

    const [gift, giftCategory] = await Promise.all([
      Gift.findById(giftId).select("_id giftCategoryId type coin image svgaImage"),
      giftCategoryId ? GiftCategory.findById(giftCategoryId).select("_id name") : null,
    ]);

    if (!gift) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "gift does not found." });
    }

    if (giftCategoryId && !giftCategory) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "GiftCategory does not found." });
    }

    gift.type = req.body.type ? req.body.type : gift.type;
    gift.coin = req.body.coin ? req.body.coin : gift.coin;
    gift.giftCategoryId = req.body.giftCategoryId ? req.body.giftCategoryId : gift.giftCategoryId;

    if (req.files.image) {
      if (gift.image) {
        const image = gift?.image?.split("storage");
        if (image) {
          if (fs.existsSync("storage" + image[1])) {
            fs.unlinkSync("storage" + image[1]);
          }
        }
      }

      gift.image = req.files.image ? req.files.image[0].path : gift.image;
    }

    if (req.body.type == 3 && req.files.svgaImage) {
      if (gift.svgaImage) {
        const svgaImage = gift?.svgaImage?.split("storage");
        if (svgaImage) {
          if (fs.existsSync("storage" + svgaImage[1])) {
            fs.unlinkSync("storage" + svgaImage[1]);
          }
        }
      }

      gift.svgaImage = req.files.svgaImage ? req.files.svgaImage[0].path : gift.svgaImage;
    }

    await gift.save();

    return res.status(200).json({ status: true, message: "Gift has been updated by the admin.", data: { ...gift.toObject(), giftCategory } });
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.log(error);
    return res.status(200).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get gifts
exports.retrieveGifts = async (req, res, next) => {
  try {
    const gift = await Gift.aggregate([
      {
        $match: { isDelete: false },
      },
      {
        $lookup: {
          from: "giftcategories",
          localField: "giftCategoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$giftCategoryId",
          categoryName: { $first: "$category.name" },
          gifts: {
            $push: {
              _id: "$_id",
              type: "$type",
              image: "$image",
              svgaImage: "$svgaImage",
              coin: "$coin",
              createdAt: "$createdAt",
            },
          },
        },
      },
      { $sort: { "gifts.createdAt": -1 } },
    ]);

    return res.status(200).json({
      status: true,
      message: "Retrive gifts for the admin.",
      data: gift,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//delete gift
exports.discardGift = async (req, res, next) => {
  try {
    const { giftId } = req.query;

    if (!giftId) {
      return res.status(200).json({ status: false, message: "giftId must be required." });
    }

    const gift = await Gift.findById(giftId).select("_id").lean();
    if (!gift) {
      return res.status(200).json({ status: false, message: "Gift does not exist." });
    }

    res.status(200).json({ status: true, message: "Gift has been marked as deleted by the admin." });

    //await Gift.findByIdAndUpdate(giftId, { isDelete: true });
    await Gift.findByIdAndDelete(giftId);
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
