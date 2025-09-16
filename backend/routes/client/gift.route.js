//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const GiftController = require("../../controllers/client/gift.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//get gifts grouped by category
route.get("/fetchGiftList", checkAccessWithSecretKey(), validateUserToken, GiftController.fetchGiftList);

module.exports = route;
