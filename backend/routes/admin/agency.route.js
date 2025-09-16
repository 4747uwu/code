//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const AgencyController = require("../../controllers/admin/agency.controller");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//create agency
route.post("/createAgency", checkAccessWithSecretKey(), upload.single("image"), AgencyController.createAgency);

//update agency
route.patch("/updateAgency", checkAccessWithSecretKey(), upload.single("image"), AgencyController.updateAgency);

//toggle agency block status
route.patch("/toggleAgencyBlockStatus", checkAccessWithSecretKey(), AgencyController.toggleAgencyBlockStatus);

//get agencies
route.get("/getAgencies", checkAccessWithSecretKey(), AgencyController.getAgencies);

//delete agency
route.delete("/deleteAgency", checkAccessWithSecretKey(), AgencyController.deleteAgency);

//get agency list ( when assign host under agency )
route.get("/getActiveAgenciesList", checkAccessWithSecretKey(), AgencyController.getActiveAgenciesList);

module.exports = route;
