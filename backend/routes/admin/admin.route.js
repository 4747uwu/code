//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const AdminController = require("../../controllers/admin/admin.controller");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//validateAdmin
const validateAdminToken = require("../../middleware/verifyAdminAuthToken.middleware");

//admin signup
route.post("/signUp", checkAccessWithSecretKey(), AdminController.signUp);

//admin login
route.post("/validateAdminLogin", checkAccessWithSecretKey(), AdminController.validateAdminLogin);

//update admin profile
route.patch("/modifyAdminProfile", checkAccessWithSecretKey(), validateAdminToken, upload.single("image"), AdminController.modifyAdminProfile);

//get admin profile
route.get("/retrieveAdminProfile", checkAccessWithSecretKey(), validateAdminToken, AdminController.retrieveAdminProfile);

//update password
route.patch("/modifyPassword", checkAccessWithSecretKey(), validateAdminToken, AdminController.modifyPassword);

//set Password
route.patch("/performPasswordReset", checkAccessWithSecretKey(), validateAdminToken, AdminController.performPasswordReset);

module.exports = route;
