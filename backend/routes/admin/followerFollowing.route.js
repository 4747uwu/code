//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const FollowerFollowingController = require("../../controllers/admin/followerFollowing.controller");

//get list of following
route.get("/fetchFollowing", checkAccessWithSecretKey(), FollowerFollowingController.fetchFollowing);

//get list of followers
route.get("/fetchFollowers", checkAccessWithSecretKey(), FollowerFollowingController.fetchFollowers);

module.exports = route;
