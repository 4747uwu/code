//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const GiftCategoryController = require("../../controllers/client/giftCategory.controller");

//retrieve all giftCategories
route.get("/listGiftCategories", checkAccessWithSecretKey(), GiftCategoryController.listGiftCategories);

module.exports = route;
