//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const LiveBroadcastHistoryController = require("../../controllers/admin/liveBroadcastHistory.cntroller");

//get live history ( host )
route.get("/fetchLiveHistory", checkAccessWithSecretKey(), LiveBroadcastHistoryController.fetchLiveHistory);

module.exports = route;
