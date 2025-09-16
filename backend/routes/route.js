//express
const express = require("express");
const route = express.Router();

//admin index.js
const admin = require("./admin/route");

//agency index.js
const agency = require("./agency/route");

//client index.js
const client = require("./client/route");

route.use("/admin", admin);
route.use("/agency", agency);
route.use("/client", client);

module.exports = route;
