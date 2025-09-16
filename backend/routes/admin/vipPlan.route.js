//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const VIPPlanController = require("../../controllers/admin/vipPlan.controller");

//create a new VIP plan
route.post("/createVipPlan", checkAccessWithSecretKey(), VIPPlanController.createVipPlan);

//update an existing VIP plan
route.patch("/updateVipPlan", checkAccessWithSecretKey(), VIPPlanController.updateVipPlan);

//toggle VIP plan status (isActive)
route.patch("/toggleVipPlanStatus", checkAccessWithSecretKey(), VIPPlanController.toggleVipPlanStatus);

//delete a VIP plan
route.delete("/deleteVipPlan", checkAccessWithSecretKey(), VIPPlanController.deleteVipPlan);

//retrieve all VIP plans
route.get("/getVipPlans", checkAccessWithSecretKey(), VIPPlanController.getVipPlans);

module.exports = route;
