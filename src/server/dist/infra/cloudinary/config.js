"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudinary_1 = require("cloudinary");
const config_1 = require("@/config");
const cloudName = config_1.config.raw.CLOUDINARY_CLOUD_NAME;
const apiKey = config_1.config.raw.CLOUDINARY_API_KEY;
const apiSecret = config_1.config.raw.CLOUDINARY_API_SECRET;
if (cloudName && apiKey && apiSecret) {
    cloudinary_1.v2.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });
}
exports.default = cloudinary_1.v2;
