//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//controller
const HostController = require("../../controllers/admin/host.controller");

//retrive host requests
route.get("/fetchHostRequest", checkAccessWithSecretKey(), HostController.fetchHostRequest);

//accept Or decline host request
route.patch("/handleHostRequest", checkAccessWithSecretKey(), HostController.handleHostRequest);

//assign host under agency
route.patch("/assignHostToAgency", checkAccessWithSecretKey(), HostController.assignHostToAgency);

//get agency's hosts
route.get("/listAgencyHosts", checkAccessWithSecretKey(), HostController.listAgencyHosts);

//create host
route.post(
  "/createHost",
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "photoGallery", maxCount: 10 },
    { name: "video", maxCount: 1 },
  ]),
  HostController.createHost
);

//update host
route.patch(
  "/updateHost",
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "photoGallery", maxCount: 10 },
    { name: "video", maxCount: 1 },
  ]),
  HostController.updateHost
);

//toggle host status
route.patch("/toggleHostStatusByType", checkAccessWithSecretKey(), HostController.toggleHostStatusByType);

//get host's profile
route.get("/fetchHostProfile", checkAccessWithSecretKey(), HostController.fetchHostProfile);

//get hosts
route.get("/fetchHostList", checkAccessWithSecretKey(), HostController.fetchHostList);

//delete host
route.delete("/deleteHost", checkAccessWithSecretKey(), HostController.deleteHost);

module.exports = route;
