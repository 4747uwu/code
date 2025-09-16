//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const AgencyController = require("../../controllers/agency/agency.controller");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//agency login
route.post("/loginAgency", checkAccessWithSecretKey(),  AgencyController.loginAgency);

//update agency
route.patch("/modifyAgency", checkAccessWithSecretKey(), upload.single("image"), AgencyController.modifyAgency);

//get agency profile
route.get("/getAgencyProfile", checkAccessWithSecretKey(), AgencyController.getAgencyProfile);

module.exports = route;
