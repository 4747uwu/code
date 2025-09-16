//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const SettingController = require("../../controllers/agency/setting.controller");

//update setting
route.patch("/modifySetting", checkAccessWithSecretKey(), SettingController.modifySetting);

//get setting
route.get("/retrieveSettings", checkAccessWithSecretKey(), SettingController.retrieveSettings);

module.exports = route;
