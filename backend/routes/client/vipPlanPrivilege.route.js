//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const VipPlanPrivilegeController = require("../../controllers/client/vipPlanPrivilege.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//get VIP Plan Privilege
route.get("/retrieveVipPrivilege", checkAccessWithSecretKey(), VipPlanPrivilegeController.retrieveVipPrivilege);

module.exports = route;
