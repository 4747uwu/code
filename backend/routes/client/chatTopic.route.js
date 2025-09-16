const express = require("express");
const route = express.Router();

//Controller
const chatTopicController = require("../../controllers/client/chatTopic.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//get chat thumb list ( user )
route.get("/fetchChatList", validateUserToken, checkAccessWithSecretKey(), chatTopicController.fetchChatList);

//get chat thumb list ( host )
route.get("/retrieveChatList", checkAccessWithSecretKey(), chatTopicController.retrieveChatList);

module.exports = route;
