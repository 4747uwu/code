//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const NotificationController = require("../../controllers/agency/notification.controller");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//sending a notification from agency to a specific host
route.post("/notifyHost", checkAccessWithSecretKey(), upload.single("image"), NotificationController.notifyHost);

//sending a notification from admin to hosts
route.post("/sendBulkHostNotifications", checkAccessWithSecretKey(), upload.single("image"), NotificationController.sendBulkHostNotifications);

module.exports = route;
