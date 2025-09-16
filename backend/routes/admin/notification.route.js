//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const NotificationController = require("../../controllers/admin/notification.controller");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//sending a notification from admin to a specific user
route.post("/sendNotificationToSingleUserByAdmin", checkAccessWithSecretKey(), upload.single("image"), NotificationController.sendNotificationToSingleUserByAdmin);

//sending a notification from admin to a specific host
route.post("/sendNotificationToSingleHostByAdmin", checkAccessWithSecretKey(), upload.single("image"), NotificationController.sendNotificationToSingleHostByAdmin);

//sending a notification from admin to user/host/both
route.post("/sendNotifications", checkAccessWithSecretKey(), upload.single("image"), NotificationController.sendNotifications);

module.exports = route;
