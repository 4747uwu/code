const crypto = require("crypto");
const Agency = require("../models/agency.model");

const generateAgencyCode = async () => {
  let uniqueCode;
  let isUnique = false;

  while (!isUnique) {
    uniqueCode = `AG${crypto.randomBytes(3).readUIntBE(0, 3) % 900000 + 100000}`;
    
    const existingAgency = await Agency.findOne({ agencyCode: uniqueCode });
    if (!existingAgency) {
      isUnique = true;
    }
  }
  return uniqueCode;
};

module.exports = generateAgencyCode;
