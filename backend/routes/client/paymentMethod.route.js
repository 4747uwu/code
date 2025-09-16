//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const PaymentMethodController = require("../../controllers/client/paymentMethod.controller");

//get payment methods
route.get("/getActivePaymentMethods", checkAccessWithSecretKey(), PaymentMethodController.getActivePaymentMethods);

module.exports = route;
