//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const GiftCategoryController = require("../../controllers/admin/giftCategory.controller");

//create giftCategory
route.post("/createGiftCategory", checkAccessWithSecretKey(), GiftCategoryController.createGiftCategory);

//update giftCategory
route.patch("/updateGiftCategory", checkAccessWithSecretKey(), GiftCategoryController.updateGiftCategory);

//retrieve all giftCategories
route.get("/getAllGiftCategories", checkAccessWithSecretKey(), GiftCategoryController.getAllGiftCategories);

//retrieve all giftCategories ( drop-down )
route.get("/listGiftCategories", checkAccessWithSecretKey(), GiftCategoryController.listGiftCategories);

//delete giftCategory
route.delete("/deleteGiftCategory", checkAccessWithSecretKey(), GiftCategoryController.deleteGiftCategory);

module.exports = route;
