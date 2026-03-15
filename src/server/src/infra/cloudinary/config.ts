import { v2 as cloudinary } from "cloudinary";
import { config } from "@/config";

const cloudName = config.raw.CLOUDINARY_CLOUD_NAME;
const cloudinaryApiKey = config.raw.CLOUDINARY_API_KEY;
const cloudinaryApiSecret = config.raw.CLOUDINARY_API_SECRET;

if (cloudName && cloudinaryApiKey && cloudinaryApiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: cloudinaryApiKey,
    api_secret: cloudinaryApiSecret,
    secure: true,
  });
}

export default cloudinary;
