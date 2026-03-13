import { v2 as cloudinary } from "cloudinary";

type CloudinaryUploadResult = {
  url: string;
  public_id: string;
};

const assertCloudinaryConfigured = () => {
  const currentConfig = cloudinary.config();
  if (
    !currentConfig.cloud_name ||
    !currentConfig.api_key ||
    !currentConfig.api_secret
  ) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }
};

export const uploadToCloudinary = async (
  files: Express.Multer.File[]
): Promise<CloudinaryUploadResult[]> => {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  assertCloudinaryConfigured();

  const uploadPromises = files.map(
    (file) =>
      new Promise<CloudinaryUploadResult>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: "image",
              fetch_format: "webp",
              quality: "auto",
              flags: "progressive",
            },
            (error, result) => {
              if (error) return reject(error);
              if (!result?.secure_url || !result.public_id) {
                return reject(new Error("Upload failed"));
              }

              resolve({
                url: result.secure_url,
                public_id: result.public_id,
              });
            }
          )
          .end(file.buffer);
      })
  );

  const results = await Promise.allSettled(uploadPromises);
  const failedUploads = results.filter((result) => result.status === "rejected");

  if (failedUploads.length > 0) {
    const firstReason = failedUploads[0] as PromiseRejectedResult;
    const errorMessage =
      firstReason.reason instanceof Error
        ? firstReason.reason.message
        : String(firstReason.reason);

    throw new Error(
      `Cloudinary upload failed for ${failedUploads.length} of ${files.length} image(s): ${errorMessage}`
    );
  }

  return results
    .filter((result): result is PromiseFulfilledResult<CloudinaryUploadResult> => {
      return result.status === "fulfilled";
    })
    .map((result) => result.value);
};
