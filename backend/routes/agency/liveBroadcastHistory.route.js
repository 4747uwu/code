//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const LiveBroadcastHistoryController = require("../../controllers/agency/liveBroadcastHistory.controller");

//get live history ( host )
route.get("/getLiveSessionHistory", checkAccessWithSecretKey(), LiveBroadcastHistoryController.getLiveSessionHistory);

module.exports = route;
