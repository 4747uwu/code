//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const UserController = require("../../controllers/admin/user.controller");

//get users
route.get("/retrieveUserList", checkAccessWithSecretKey(), UserController.retrieveUserList);

//toggle user's block status
route.patch("/modifyUserBlockStatus", checkAccessWithSecretKey(), UserController.modifyUserBlockStatus);

//get user's profile
route.get("/fetchUserProfile", checkAccessWithSecretKey(), UserController.fetchUserProfile);

module.exports = route;
