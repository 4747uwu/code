const DailyRewardCoin = require("../../models/dailyRewardCoin.model");

//create daily reward
exports.createDailyReward = async (req, res) => {
  try {
    const { day, dailyRewardCoin } = req.body;

    if (!day || !dailyRewardCoin) {
      return res.status(200).json({ status: false, message: "Oops! Invalid details!" });
    }

    if (day < 1 || day > 7) {
      return res.status(200).json({ status: false, message: "Day must be between 1 and 7" });
    }

    const [totalAdReward, existingDayReward] = await Promise.all([DailyRewardCoin.countDocuments(), DailyRewardCoin.findOne({ day })]);

    if (totalAdReward >= 7) {
      return res.status(200).json({
        status: false,
        message: "You have reached the maximum number of rewards allowed for this week.",
      });
    }

    if (existingDayReward) {
      return res.status(200).json({ status: false, message: `Reward for day ${day} already exists.` });
    }

    const dailyReward = new DailyRewardCoin({
      dailyRewardCoin: parseInt(dailyRewardCoin),
      day,
    });

    await dailyReward.save();

    return res.status(200).json({
      status: true,
      message: "DailyRewardCoin created successfully",
      data: dailyReward,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server error" });
  }
};

//update daily reward
exports.modifyDailyReward = async (req, res) => {
  try {
    if (!req.body.dailyRewardCoinId) {
      return res.status(200).json({ status: false, message: "dailyRewardCoinId must be needed." });
    }

    const dailyReward = await DailyRewardCoin.findOne({ _id: req.body.dailyRewardCoinId });
    if (!dailyReward) {
      return res.status(200).json({ status: false, message: "dailyReward not found." });
    }

    dailyReward.dailyRewardCoin = req.body.dailyRewardCoin ? parseInt(req.body.dailyRewardCoin) : dailyReward.dailyRewardCoin;
    await dailyReward.save();

    return res.status(200).json({
      status: true,
      message: "DailyRewardCoin update Successfully",
      data: dailyReward,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server error" });
  }
};

//get daily reward
exports.fetchDailyReward = async (req, res) => {
  try {
    const dailyReward = await DailyRewardCoin.find().sort({ day: 1 });

    return res.status(200).json({
      status: true,
      message: "Retrive DailyRewardCoin Successfully",
      data: dailyReward,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server error" });
  }
};

//delete daily reward
exports.removeDailyReward = async (req, res) => {
  try {
    if (!req.query.dailyRewardCoinId) {
      return res.status(200).json({ status: false, message: "dailyRewardCoinId must be needed." });
    }

    const dailyReward = await DailyRewardCoin.findOne({ _id: req.query.dailyRewardCoinId });
    if (!dailyReward) {
      return res.status(200).json({ status: false, message: "dailyReward not found." });
    }

    await dailyReward.deleteOne();

    return res.status(200).json({
      status: true,
      message: "DailyRewardCoin delete Successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server error" });
  }
};
