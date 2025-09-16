//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const IdentityProofController = require("../../controllers/admin/identityProof.controller");

//create a new identity proof type
route.post("/createIdentityProof", checkAccessWithSecretKey(), IdentityProofController.createIdentityProof);

//update an existing identity proof type
route.patch("/updateIdentityProof", checkAccessWithSecretKey(), IdentityProofController.updateIdentityProof);

//retrieve all identity proof types
route.get("/getIdentityProofs", checkAccessWithSecretKey(), IdentityProofController.getIdentityProofs);

//delete an identity proof type
route.delete("/deleteIdentityProof", checkAccessWithSecretKey(), IdentityProofController.deleteIdentityProof);

module.exports = route;
