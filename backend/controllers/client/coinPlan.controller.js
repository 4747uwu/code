const CoinPlan = require("../../models/coinPlan.model");

//import model
const User = require("../../models/user.model");
const History = require("../../models/history.model");

//mongoose
const mongoose = require("mongoose");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//get coinPlan
exports.getCoinPackage = async (req, res) => {
  try {
    const coinPlan = await CoinPlan.find({ isActive: true }).sort({ coin: 1, amount: 1 }).lean();

    return res.status(200).json({
      status: true,
      message: "Retrive CoinPlan Successfully",
      data: coinPlan,
    });
  } catch {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server error" });
  }
};

//purchase coinPlan ( coinPlan history )
exports.recordCoinPlanPurchase = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { coinPlanId, paymentGateway } = req.query;

    if (!coinPlanId || !paymentGateway) {
      return res.json({ status: false, message: "Oops! Invalid details." });
    }

    const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
    const coinPlanObjectId = new mongoose.Types.ObjectId(coinPlanId);
    const trimmedPaymentGateway = paymentGateway.trim();

    const [uniqueId, user, coinPlan] = await Promise.all([
      generateHistoryUniqueId(),
      User.findById(userObjectId).select("_id isVip").lean(),
      CoinPlan.findById(coinPlanObjectId).select("_id coins bonusCoins price").lean(),
    ]);

    if (!user) {
      return res.status(200).json({ status: false, message: "user does not found." });
    }

    if (!coinPlan) {
      return res.status(200).json({ status: false, message: "CoinPlan does not found." });
    }

    const totalCoins = user.isVip ? coinPlan.coins + coinPlan.bonusCoins : coinPlan.coins;

    res.status(200).json({
      status: true,
      message: "Coin plan history created successfully after user purchase.",
      totalCoins: totalCoins,
    });

    await Promise.all([
      User.updateOne({ _id: userObjectId }, { $inc: { coin: totalCoins, rechargedCoins: totalCoins } }),
      History.create({
        uniqueId: uniqueId,
        type: 7,
        userId: user._id,
        userCoin: totalCoins,
        bonusCoins: user.isVip ? coinPlan.bonusCoins : 0,
        price: coinPlan?.price,
        paymentGateway: trimmedPaymentGateway,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }),
    ]);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
