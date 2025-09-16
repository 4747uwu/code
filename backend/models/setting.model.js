const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    privacyPolicyLink: { type: String, default: "PRIVACY POLICY LINK" },
    termsOfUsePolicyLink: { type: String, default: "TERMS OF USE POLICY LINK" },

    googlePlayEnabled: { type: Boolean, default: false },

    stripeEnabled: { type: Boolean, default: false },
    stripePublishableKey: { type: String, default: "STRIPE PUBLISHABLE KEY" },
    stripeSecretKey: { type: String, default: "STRIPE SECRET KEY" },

    razorpayEnabled: { type: Boolean, default: false },
    razorpayId: { type: String, default: "RAZOR PAY ID" },
    razorpaySecretKey: { type: String, default: "RAZOR SECRET KEY" },

    flutterwaveEnabled: { type: Boolean, default: false },
    flutterwaveId: { type: String, default: "FLUTTER WAVE ID" },

    agoraAppId: { type: String, default: "AGORA APP ID" },
    agoraAppCertificate: { type: String, default: "AGORA APP CERTIFICATE" },

    loginBonus: { type: Number, default: 0 },
    isDemoData: { type: Boolean, default: false },

    isAppEnabled: { type: Boolean, default: true },

    currency: {
      name: { type: String, default: "" },
      symbol: { type: String, default: "" },
      countryCode: { type: String, default: "" },
      currencyCode: { type: String, default: "" },
      isDefault: { type: Boolean, default: false },
    }, //default currency

    privateKey: { type: Object, default: {} }, //firebase.json handle notification

    generalRandomCallRate: { type: Number, default: 0 },
    femaleRandomCallRate: { type: Number, default: 0 },
    maleRandomCallRate: { type: Number, default: 0 },
    videoPrivateCallRate: { type: Number, default: 0 },
    audioPrivateCallRate: { type: Number, default: 0 },

    maxFreeChatMessages: { type: Number, default: 0 }, //maximum free messages allowed
    chatInteractionRate: { type: Number, default: 0 },

    adminCommissionRate: { type: Number, default: 0 }, //in %
    minCoinsToConvert: { type: Number, default: 0 }, //min coin requried for convert coin to default currency i.e., 1000 coin = 1 $

    minCoinsForHostPayout: { type: Number, default: 0 }, //for host
    minCoinsForAgencyPayout: { type: Number, default: 0 }, //for agency
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

settingSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Setting", settingSchema);
