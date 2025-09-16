//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const BlockController = require("../../controllers/admin/block.controller");

//get blocked hosts for a user
route.get("/listBlockedHostsForUser", checkAccessWithSecretKey(), BlockController.listBlockedHostsForUser);

//get blocked users for a host
route.get("/listBlockedUsersForHost", checkAccessWithSecretKey(), BlockController.listBlockedUsersForHost);

module.exports = route;
