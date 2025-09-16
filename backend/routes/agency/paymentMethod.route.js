//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const PaymentMethodController = require("../../controllers/agency/paymentMethod.controller");

//Get All Payment Methods
route.get("/fetchPaymentMethods", checkAccessWithSecretKey(), PaymentMethodController.fetchPaymentMethods);

module.exports = route;
