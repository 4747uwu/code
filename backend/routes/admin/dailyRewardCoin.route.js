//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const DailyRewardCoinController = require("../../controllers/admin/dailyRewardCoin.controller");

//create daily reward
route.post("/createDailyReward", checkAccessWithSecretKey(), DailyRewardCoinController.createDailyReward);

//update daily reward
route.patch("/modifyDailyReward", checkAccessWithSecretKey(), DailyRewardCoinController.modifyDailyReward);

//get daily reward
route.get("/fetchDailyReward", checkAccessWithSecretKey(), DailyRewardCoinController.fetchDailyReward);

//delete daily reward
route.delete("/removeDailyReward", checkAccessWithSecretKey(), DailyRewardCoinController.removeDailyReward);

module.exports = route;
