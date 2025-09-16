//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const WithdrawalRequestController = require("../../controllers/agency/withdrawalRequest.controller");

//get withdrawal requests ( host / agency )
route.get("/fetchPayoutRequests", checkAccessWithSecretKey(), WithdrawalRequestController.fetchPayoutRequests);

//accept or decline withdrawal requests ( host )
route.patch("/updateWithdrawalStatus", checkAccessWithSecretKey(), WithdrawalRequestController.updateWithdrawalStatus);

//submit withdrawal request ( agency )
route.post("/initiateWithdrawal", checkAccessWithSecretKey(), WithdrawalRequestController.initiateWithdrawal);

module.exports = route;
