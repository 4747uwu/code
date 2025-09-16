//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const CoinPlanController = require("../../controllers/admin/coinPlan.controller");

//create a new coin plan
route.post("/createCoinPlan", checkAccessWithSecretKey(), CoinPlanController.createCoinPlan);

//update an existing coin plan
route.patch("/modifyCoinPlan", checkAccessWithSecretKey(), CoinPlanController.modifyCoinPlan);

//toggle coin plan status (isActive or isFeatured)
route.patch("/toggleCoinPlanStatus", checkAccessWithSecretKey(), CoinPlanController.toggleCoinPlanStatus);

//delete a coin plan
route.delete("/removeCoinPlan", checkAccessWithSecretKey(), CoinPlanController.removeCoinPlan);

//retrieve all coin plans
route.get("/fetchCoinPlans", checkAccessWithSecretKey(), CoinPlanController.fetchCoinPlans);

//get coinplan histories of users (admin earning)
route.get("/retrieveUserPurchaseRecords", checkAccessWithSecretKey(), CoinPlanController.retrieveUserPurchaseRecords);

module.exports = route;
