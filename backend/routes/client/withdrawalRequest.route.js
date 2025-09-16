//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const WithdrawalRequestController = require("../../controllers/client/withdrawalRequest.controller");

//withdrawal request ( host )
route.post("/submitWithdrawalRequest", checkAccessWithSecretKey(), WithdrawalRequestController.submitWithdrawalRequest);

//get withdrawal requests ( host )
route.get("/listPayoutRequests", checkAccessWithSecretKey(), WithdrawalRequestController.listPayoutRequests);

module.exports = route;
