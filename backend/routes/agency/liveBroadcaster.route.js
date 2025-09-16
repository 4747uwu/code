//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const LiveBroadcasterController = require("../../controllers/agency/liveBroadcaster.controller");

//get live hosts
route.get("/getLiveHosts", checkAccessWithSecretKey(), LiveBroadcasterController.getLiveHosts);

module.exports = route;
