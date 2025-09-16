//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const FollowerFollowingController = require("../../controllers/client/followerFollowing.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//follow or unfollow
route.post("/handleFollowUnfollow", validateUserToken, checkAccessWithSecretKey(), FollowerFollowingController.handleFollowUnfollow);

//get list of following
route.get("/getFollowingList", validateUserToken, checkAccessWithSecretKey(), FollowerFollowingController.getFollowingList);

//get list of followers
route.get("/getFollowerList", checkAccessWithSecretKey(), FollowerFollowingController.getFollowerList);

module.exports = route;
