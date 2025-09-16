//express
const express = require("express");
const route = express.Router();

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//require client's route.js
const user = require("./user.route");
const host = require("./host.route");
const followerFollowing = require("./followerFollowing.route");
const block = require("./block.route");
const dailyRewardCoin = require("./dailyRewardCoin.route");
const giftCategory = require("./giftCategory.route");
const gift = require("./gift.route");
const coinPlan = require("./coinPlan.route");
const vipPlan = require("./vipPlan.route");
const vipPlanPrivilege = require("./vipPlanPrivilege.route");
const paymentMethod = require("./paymentMethod.route");
const chatTopic = require("./chatTopic.route");
const chat = require("./chat.route");
const setting = require("./setting.route");
const history = require("./history.route");
const liveBroadcaster = require("./liveBroadcaster.route");
const identityProof = require("./identityProof.route");
const withdrawalRequest = require("./withdrawalRequest.route");

//exports client's route.js
route.use("/user", user);
route.use("/host", host);
route.use("/followerFollowing", followerFollowing);
route.use("/block", block);
route.use("/dailyRewardCoin", dailyRewardCoin);
route.use("/giftCategory", giftCategory);
route.use("/gift", gift);
route.use("/coinPlan", coinPlan);
route.use("/vipPlan", vipPlan);
route.use("/vipPlanPrivilege", vipPlanPrivilege);
route.use("/paymentMethod", paymentMethod);
route.use("/chatTopic", chatTopic);
route.use("/chat", chat);
route.use("/setting", setting);
route.use("/history", history);
route.use("/liveBroadcaster", liveBroadcaster);
route.use("/identityProof", identityProof);
route.use("/withdrawalRequest", withdrawalRequest);

module.exports = route;
