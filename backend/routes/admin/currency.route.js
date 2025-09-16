const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const currencyController = require("../../controllers/admin/currency.controller");

//create currency
route.post("/createCurrency", checkAccessWithSecretKey(), currencyController.createCurrency);

//update currency
route.patch("/updateCurrency", checkAccessWithSecretKey(), currencyController.updateCurrency);

//get currencies
route.get("/fetchCurrencyData", checkAccessWithSecretKey(), currencyController.fetchCurrencyData);

//delete currency
route.delete("/destroyCurrency", checkAccessWithSecretKey(), currencyController.destroyCurrency);

//set default currency
route.patch("/setdefaultCurrency", checkAccessWithSecretKey(), currencyController.setdefaultCurrency);

//get default currency
route.get("/getDefaultCurrency", checkAccessWithSecretKey(), currencyController.getDefaultCurrency);

module.exports = route;
