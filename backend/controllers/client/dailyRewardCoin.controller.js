const DailyRewardCoin = require("../../models/dailyRewardCoin.model");

//import model
const User = require("../../models/user.model");
const History = require("../../models/history.model");
const CheckIn = require("../../models/checkIn.model");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//mongoose
const mongoose = require("mongoose");

//private key
const admin = require("../../util/privateKey");

//get daily reward coin
exports.retrieveDailyCoins = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const [user, userCheckIn, dailyRewards] = await Promise.all([
      User.findOne({ _id: userId }).select("coin").lean(),
      CheckIn.findOne({ userId }).select("rewardsCollected lastCheckInDate consecutiveDays").lean(),
      DailyRewardCoin.find().sort({ day: 1 }).select("day dailyRewardCoin").lean(),
    ]);

    const checkInStatus = dailyRewards.map((rewardDay) => {
      const userReward = userCheckIn ? userCheckIn.rewardsCollected.find((checkIn) => checkIn.day === rewardDay.day) : null;

      let checkInDateFormatted = null;
      if (userReward && userReward.isCheckIn && userCheckIn.lastCheckInDate) {
        try {
          checkInDateFormatted = new Date(userCheckIn.lastCheckInDate).toISOString().slice(0, 10); // 'YYYY-MM-DD'
        } catch (error) {
          console.error("Invalid date format", error);
        }
      }

      return {
        day: rewardDay.day,
        reward: rewardDay.dailyRewardCoin,
        isCheckIn: userReward ? userReward.isCheckIn : false,
        checkInDate: checkInDateFormatted,
      };
    });

    return res.status(200).json({
      status: true,
      message: "Retrieve DailyRewardCoin Successfully",
      data: checkInStatus,
      streak: userCheckIn ? userCheckIn.consecutiveDays : 0,
      totalCoins: user ? user.coin : 0,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server error" });
  }
};

//earn coin from daily check In
exports.processDailyCheckIn = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.query.dailyRewardCoin) {
      return res.status(200).json({ status: false, message: "Oops! Invalid details!" });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const dailyRewardCoin = parseInt(req.query.dailyRewardCoin);

    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' format
    const dayOfWeek = ((new Date(today).getDay() + 6) % 7) + 1; // Monday = 1, Sunday = 7

    const [uniqueId, user, userCheckIn, rewardForToday] = await Promise.all([
      generateHistoryUniqueId(),
      User.findOne({ _id: userId }).select("isBlock coin rewardCoin fcmToken").lean(),
      CheckIn.findOne({ userId }).select("rewardsCollected lastCheckInDate consecutiveDays"),
      DailyRewardCoin.findOne({ dailyRewardCoin, day: dayOfWeek }).select("dailyRewardCoin").lean(),
    ]);

    if (!rewardForToday) {
      return res.status(200).json({ status: false, message: "No reward configured for today." });
    }

    if (userCheckIn) {
      //Find today's check-in for the current week (same day of the week)
      const lastCheckInDate = userCheckIn?.lastCheckInDate ? new Date(userCheckIn.lastCheckInDate).toISOString().slice(0, 10) : null;

      //Check if user has already checked in today
      if (lastCheckInDate === today) {
        return res.status(200).json({ status: false, message: "You have already checked in today." });
      }
    }

    res.status(200).json({
      status: true,
      message: "Check-in successful",
      isCheckIn: true,
    });

    let updatedUserCheckIn = userCheckIn;
    if (!updatedUserCheckIn) {
      updatedUserCheckIn = new CheckIn({
        userId,
        rewardsCollected: [],
        consecutiveDays: 0,
      });
    }

    updatedUserCheckIn.rewardsCollected.push({
      day: dayOfWeek,
      isCheckIn: true,
      reward: rewardForToday.dailyRewardCoin || dailyRewardCoin,
      checkInDate: today,
    });

    const lastCheckInDate = userCheckIn?.lastCheckInDate ? new Date(userCheckIn.lastCheckInDate).toISOString().slice(0, 10) : null;

    if (lastCheckInDate && (new Date(today) - new Date(lastCheckInDate)) / (1000 * 60 * 60 * 24) === 1) {
      updatedUserCheckIn.consecutiveDays += 1;
    } else {
      updatedUserCheckIn.consecutiveDays = 1;
    }

    updatedUserCheckIn.lastCheckInDate = today; // YYYY-MM-DD

    await Promise.all([
      updatedUserCheckIn.save(),
      User.findOneAndUpdate(
        { _id: user._id },
        {
          $inc: {
            coin: dailyRewardCoin,
            rewardCoin: dailyRewardCoin,
          },
        },
        { new: true }
      ),
      History.create({
        uniqueId: uniqueId,
        userId: user._id,
        userCoin: dailyRewardCoin,
        type: 6,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }),
    ]);

    if (user.fcmToken && user.fcmToken !== null) {
      const adminPromise = await admin;

      const payload = {
        token: user.fcmToken,
        notification: {
          title: "🌟 Daily Check-in Reward Unlocked! 💰",
          body: `Way to go! You've earned ${dailyRewardCoin} coins for checking in today. Come back tomorrow for more rewards! 🌟💸`,
        },
        data: {
          type: "DAILY_CHECKIN_REWARD",
        },
      };

      adminPromise
        .messaging()
        .send(payload)
        .then((response) => {
          console.log("Successfully sent with response: ", response);
        })
        .catch((error) => {
          console.log("Error sending message: ", error);
        });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
