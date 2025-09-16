//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const IdentityProofController = require("../../controllers/client/identityProof.controller");

//retrieve all identity proof types
route.get("/fetchIdentityDocuments", checkAccessWithSecretKey(), IdentityProofController.fetchIdentityDocuments);

module.exports = route;
