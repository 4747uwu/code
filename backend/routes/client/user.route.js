//express
const express = require("express");
const route = express.Router();

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//validateFirebaseToken
const validateAuthToken = require("../../middleware/verifyAuthToken.middleware");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//controller
const UserController = require("../../controllers/client/user.controller");

//check the user is exists or not with loginType 3 quick (identity)
route.post("/quickUserVerification", checkAccessWithSecretKey(), UserController.quickUserVerification);

//user login or sign up
route.post("/signInOrSignUpUser", validateAuthToken, checkAccessWithSecretKey(), UserController.signInOrSignUpUser);

//update profile of the user
route.patch("/modifyUserProfile", validateUserToken, checkAccessWithSecretKey(), upload.single("image"), UserController.modifyUserProfile);

//get user profile
route.get("/retrieveUserProfile", validateUserToken, checkAccessWithSecretKey(), UserController.retrieveUserProfile);

module.exports = route;
