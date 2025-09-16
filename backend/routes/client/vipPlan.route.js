//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const VipPlanController = require("../../controllers/client/vipPlan.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//get vipPlan
route.get("/fetchVipPlans", checkAccessWithSecretKey(), VipPlanController.fetchVipPlans);

//purchase vipPlan ( vipPlan history )
route.post("/purchaseVipPlan", validateUserToken, checkAccessWithSecretKey(), VipPlanController.purchaseVipPlan);

module.exports = route;
