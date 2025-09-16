//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const HistoryController = require("../../controllers/admin/history.controller");

//get coin history ( user )
route.get("/getCoinTransactionHistory", checkAccessWithSecretKey(), HistoryController.getCoinTransactionHistory);

//get call history ( user )
route.get("/fetchCallTransactionHistory", checkAccessWithSecretKey(), HistoryController.fetchCallTransactionHistory);

//get gift history ( user )
route.get("/retrieveGiftTransactionHistory", checkAccessWithSecretKey(), HistoryController.retrieveGiftTransactionHistory);

//get vipPlan purchase history ( user )
route.get("/getVIPPlanTransactionHistory", checkAccessWithSecretKey(), HistoryController.getVIPPlanTransactionHistory);

//get coinplan purchase history ( user )
route.get("/fetchCoinPlanTransactionHistory", checkAccessWithSecretKey(), HistoryController.fetchCoinPlanTransactionHistory);

//get coin history ( host )
route.get("/fetchCoinTransactionHistory", checkAccessWithSecretKey(), HistoryController.fetchCoinTransactionHistory);

//get call history ( host )
route.get("/listCallTransactions", checkAccessWithSecretKey(), HistoryController.listCallTransactions);

//get gift history ( host )
route.get("/fetchGiftTransactionHistory", checkAccessWithSecretKey(), HistoryController.fetchGiftTransactionHistory);

module.exports = route;
