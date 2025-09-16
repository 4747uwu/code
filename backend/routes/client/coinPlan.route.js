const express = require("express");
const route = express.Router();

//Controller
const coinplanController = require("../../controllers/client/coinPlan.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//get coinplan
route.get("/getCoinPackage", checkAccessWithSecretKey(), coinplanController.getCoinPackage);

//purchase coinPlan ( coinPlan history )
route.post("/recordCoinPlanPurchase", validateUserToken, checkAccessWithSecretKey(), coinplanController.recordCoinPlanPurchase);

module.exports = route;
