//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const SettingController = require("../../controllers/admin/setting.controller");

//update setting
route.patch("/updateSetting", checkAccessWithSecretKey(), SettingController.updateSetting);

//update setting switch
route.patch("/updateSettingToggle", checkAccessWithSecretKey(), SettingController.updateSettingToggle);

//get setting
route.get("/fetchSettings", checkAccessWithSecretKey(), SettingController.fetchSettings);

module.exports = route;
