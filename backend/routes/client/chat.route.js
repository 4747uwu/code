//express
const express = require("express");
const route = express.Router();

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const ChatController = require("../../controllers/client/chat.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//send message ( image or audio ) ( user )
route.post(
  "/pushChatMessage",
  validateUserToken,
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  ChatController.pushChatMessage
);

//get old chat ( user )
route.get("/fetchChatHistory", validateUserToken, checkAccessWithSecretKey(), ChatController.fetchChatHistory);

//send message ( image or audio ) ( host )
route.post(
  "/submitChatMessage",
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  ChatController.submitChatMessage
);

//get old chat ( host )
route.get("/retrieveChatHistory", checkAccessWithSecretKey(), ChatController.retrieveChatHistory);

module.exports = route;
