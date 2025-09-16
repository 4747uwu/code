//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const HistoryController = require("../../controllers/agency/history.controller");

//get coin history ( host )
route.get("/getCoinTransactions", checkAccessWithSecretKey(), HistoryController.getCoinTransactions);

//get call history ( host )
route.get("/getCallTransactions", checkAccessWithSecretKey(), HistoryController.getCallTransactions);

//get gift history ( host )
route.get("/getGiftTransactions", checkAccessWithSecretKey(), HistoryController.getGiftTransactions);

//get agency's earnings
route.get("/retrieveAgencyEarnings", checkAccessWithSecretKey(), HistoryController.retrieveAgencyEarnings);

module.exports = route;
