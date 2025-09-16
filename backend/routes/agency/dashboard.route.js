//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const DashboardController = require("../../controllers/agency/dashboard.controller");

//get dashboard count
route.get("/retrieveDashboardStats", checkAccessWithSecretKey(), DashboardController.retrieveDashboardStats);

//get new hosts
route.get("/retrieveRecentHosts", checkAccessWithSecretKey(), DashboardController.retrieveRecentHosts);

//get top performing host
route.get("/listTopEarningHosts", checkAccessWithSecretKey(), DashboardController.listTopEarningHosts);

//get earnings ( chart )
route.get("/getEarningsReport", checkAccessWithSecretKey(), DashboardController.getEarningsReport);

module.exports = route;
