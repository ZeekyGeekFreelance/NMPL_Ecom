import { v2 as cloudinary } from "cloudinary";
import { config } from "@/config";

const cloudName = config.raw.CLOUDINARY_CLOUD_NAME;
const apiKey = config.raw.CLOUDINARY_API_KEY;
const apiSecret = config.raw.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export default cloudinary;
