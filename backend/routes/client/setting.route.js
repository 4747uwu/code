//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const SettingController = require("../../controllers/client/setting.controller");

//get setting
route.get("/retrieveAppSettings", checkAccessWithSecretKey(), SettingController.retrieveAppSettings);

module.exports = route;
