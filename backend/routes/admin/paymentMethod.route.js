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
const PaymentMethodController = require("../../controllers/admin/paymentMethod.controller");

//Create Payment Method
route.post("/addPaymentMethod", checkAccessWithSecretKey(), upload.single("image"), PaymentMethodController.addPaymentMethod);

//Update Payment Method
route.patch("/modifyPaymentMethod", checkAccessWithSecretKey(), upload.single("image"), PaymentMethodController.modifyPaymentMethod);

//handle the isActive status of the payment method
route.patch("/updatePaymentMethodStatus", checkAccessWithSecretKey(),  PaymentMethodController.updatePaymentMethodStatus);

//Get All Payment Methods
route.get("/retrievePaymentMethods", checkAccessWithSecretKey(), PaymentMethodController.retrievePaymentMethods);

//Disable Payment Method
route.delete("/discardPaymentMethod", checkAccessWithSecretKey(), PaymentMethodController.discardPaymentMethod);

module.exports = route;
