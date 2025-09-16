//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const GiftController = require("../../controllers/admin/gift.controller");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//create gift
route.post(
  "/addGift",
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "svgaImage", maxCount: 1 },
  ]),
  GiftController.addGift
);

//update gift
route.patch(
  "/modifyGift",
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "svgaImage", maxCount: 1 },
  ]),
  GiftController.modifyGift
);

//get gifts
route.get("/retrieveGifts", checkAccessWithSecretKey(), GiftController.retrieveGifts);

//delete gift
route.delete("/discardGift", checkAccessWithSecretKey(), GiftController.discardGift);

module.exports = route;
