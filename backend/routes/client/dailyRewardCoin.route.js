//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const DailyRewardCoinController = require("../../controllers/client/dailyRewardCoin.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//get daily reward coin
route.get("/retrieveDailyCoins", validateUserToken, checkAccessWithSecretKey(), DailyRewardCoinController.retrieveDailyCoins);

//earn coin from daily check In
route.post("/processDailyCheckIn", validateUserToken, checkAccessWithSecretKey(), DailyRewardCoinController.processDailyCheckIn);

module.exports = route;
