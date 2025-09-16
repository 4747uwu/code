//express
const express = require("express");
const route = express.Router();

//validate agency's access token
const validateAgencyToken = require("../../middleware/validateAgencyToken.middleware");

//require agency's route.js
const agency = require("./agency.route");
const paymentMethod = require("./paymentMethod.route");
const host = require("./host.route");
const history = require("./history.route");
const withdrawalRequest = require("./withdrawalRequest.route");
const dashboard = require("./dashboard.route");
const liveBroadcaster = require("./liveBroadcaster.route");
const liveBroadcastHistory = require("./liveBroadcastHistory.route");
const setting = require("./setting.route");
const notification = require("./notification.route");

//exports agency's route.js
route.use("/", validateAgencyToken, agency);
route.use("/paymentMethod", validateAgencyToken, paymentMethod);
route.use("/host", validateAgencyToken, host);
route.use("/history", validateAgencyToken, history);
route.use("/withdrawalRequest", validateAgencyToken, withdrawalRequest);
route.use("/dashboard", validateAgencyToken, dashboard);
route.use("/liveBroadcaster", validateAgencyToken, liveBroadcaster);
route.use("/liveBroadcastHistory", validateAgencyToken, liveBroadcastHistory);
route.use("/setting", validateAgencyToken, setting);
route.use("/notification", notification);

module.exports = route;
