//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const LiveBrpadcasterController = require("../../controllers/client/liveBroadcaster.controller");

//live host
route.post("/HostStreaming", checkAccessWithSecretKey(), LiveBrpadcasterController.HostStreaming);

module.exports = route;
