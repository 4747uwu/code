//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const ImpressionController = require("../../controllers/admin/impression.controller");

//create Impression
route.post("/createImpression", checkAccessWithSecretKey(), ImpressionController.createImpression);

//update Impression
route.patch("/updateImpression", checkAccessWithSecretKey(), ImpressionController.updateImpression);

//get all Impressions
route.get("/getImpressions", checkAccessWithSecretKey(), ImpressionController.getImpressions);

//get all Impressions ( drop - down )
route.get("/fetchAdImpressionMetrics", checkAccessWithSecretKey(), ImpressionController.fetchAdImpressionMetrics);

//delete Impression
route.delete("/deleteImpression", checkAccessWithSecretKey(), ImpressionController.deleteImpression);

module.exports = route;
