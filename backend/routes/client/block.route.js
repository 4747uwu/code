//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const BlockController = require("../../controllers/client/block.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//handle user blocking a host
route.post("/blockHost", validateUserToken, checkAccessWithSecretKey(), BlockController.blockHost);

//handle host blocking a user
route.post("/blockUser", checkAccessWithSecretKey(), BlockController.blockUser);

//get blocked hosts for a user
route.get("/getBlockedHostsForUser", validateUserToken, checkAccessWithSecretKey(), BlockController.getBlockedHostsForUser);

//get blocked users for a host
route.get("/getBlockedUsersForHost", checkAccessWithSecretKey(), BlockController.getBlockedUsersForHost);

module.exports = route;
