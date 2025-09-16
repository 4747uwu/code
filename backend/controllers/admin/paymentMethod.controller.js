const PaymentMethod = require("../../models/paymentMethod.model");

//fs
const fs = require("fs");

//Create Payment Method
exports.addPaymentMethod = async (req, res, next) => {
  try {
    const { name, details } = req.body;

    if (!name) {
      return res.status(200).json({ status: false, message: "Name is required." });
    }

    if (details && !Array.isArray(details)) {
      return res.status(200).json({ status: false, message: "Details must be an array of strings." });
    }

    const method = new PaymentMethod({
      name,
      image: req.file ? req.file.path : "",
      details: details || [],
    });

    await method.save();

    return res.status(200).json({
      status: true,
      message: "Payment method has been created by the admin.",
      data: method,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//Update Payment Method
exports.modifyPaymentMethod = async (req, res, next) => {
  try {
    const { paymentMethodId, name, details } = req.body;

    if (!paymentMethodId) {
      return res.status(200).json({ status: false, message: "paymentMethodId is required." });
    }

    const method = await PaymentMethod.findById(paymentMethodId);
    if (!method) {
      return res.status(200).json({ status: false, message: "Payment method not found." });
    }

    if (req.file) {
      if (method.image) {
        const imagePath = method.image.includes("storage") ? "storage" + method.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) {
          const imageName = imagePath.split("/").pop();
          if (!["male.png", "female.png"].includes(imageName)) {
            fs.unlinkSync(imagePath);
          }
        }
      }
      method.image = req.file.path;
    }

    method.name = name ?? method.name;
    method.details = Array.isArray(details) ? details : method.details;
    await method.save();

    return res.status(200).json({
      status: true,
      message: "Payment method has been updated by the admin.",
      data: method,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//handle the isActive status of the payment method
exports.updatePaymentMethodStatus = async (req, res, next) => {
  try {
    const { paymentMethodId } = req.query;

    if (!paymentMethodId) {
      return res.status(200).json({ status: false, message: "paymentMethodId is required." });
    }

    const method = await PaymentMethod.findById(paymentMethodId);
    if (!method) {
      return res.status(200).json({ status: false, message: "Payment method not found." });
    }

    method.isActive = !method.isActive;
    await method.save();

    return res.status(200).json({
      status: true,
      message: "Payment method has been updated successfully.",
      data: method,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//Get All Payment Methods
exports.retrievePaymentMethods = async (req, res, next) => {
  try {
    const methods = await PaymentMethod.find().sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      status: true,
      message: "Retrieved payment methods for the admin.",
      data: methods,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//Disable Payment Method
exports.discardPaymentMethod = async (req, res, next) => {
  try {
    const { paymentMethodId } = req.query;

    if (!paymentMethodId) {
      return res.status(200).json({ status: false, message: "paymentMethodId is required." });
    }

    const method = await PaymentMethod.findById(paymentMethodId).select("_id image");
    if (!method) {
      return res.status(200).json({ status: false, message: "Payment method does not exist." });
    }

    res.status(200).json({ status: true, message: "Payment method has been disabled by the admin." });

    if (method.image) {
      const imagePath = method.image.includes("storage") ? "storage" + method.image.split("storage")[1] : "";
      if (imagePath && fs.existsSync(imagePath)) {
        const imageName = imagePath.split("/").pop();
        if (!["male.png", "female.png"].includes(imageName)) {
          fs.unlinkSync(imagePath);
        }
      }
    }

    await PaymentMethod.findByIdAndDelete(paymentMethodId);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
