import { NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "@/lib/auth/guard";
import { ok, handleError, error } from "@/lib/api";
import { config } from "@/lib/config";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;

    if (!config.cloudinary.cloudName) {
      return error("Cloudinary is not configured", 503);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return error("No file provided");

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder: "nmpl/products",
      resource_type: "image",
    });

    return ok({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    return handleError(err);
  }
}
