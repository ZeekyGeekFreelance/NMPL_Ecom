import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import { ProductService } from "./product.service";
import slugify from "@/shared/utils/slugify";
import { makeLogsService } from "../logs/logs.factory";
import { uploadToCloudinary } from "@/shared/utils/uploadToCloudinary";
import AppError from "@/shared/errors/AppError";
import logger from "@/infra/winston/logger";

const UPLOADED_IMAGE_TOKEN_PREFIX = "__UPLOADED_FILE_INDEX__";

export class ProductController {
  private logsService = makeLogsService();
  constructor(private productService: ProductService) {}

  getAllProducts = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const {
        products,
        totalResults,
        totalPages,
        currentPage,
        resultsPerPage,
      } = await this.productService.getAllProducts(req.query);
      sendResponse(res, 200, {
        data: {
          products,
          totalResults,
          totalPages,
          currentPage,
          resultsPerPage,
        },
        message: "Products fetched successfully",
      });
    }
  );

  getProductById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id: productId } = req.params;
      const product = await this.productService.getProductById(productId);
      sendResponse(res, 200, {
        data: product,
        message: "Product fetched successfully",
      });
    }
  );

  getProductBySlug = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { slug: productSlug } = req.params;
      const product = await this.productService.getProductBySlug(productSlug);
      sendResponse(res, 200, {
        data: product,
        message: "Product fetched successfully",
      });
    }
  );

  createProduct = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const {
        name,
        description,
        isNew,
        isTrending,
        isBestSeller,
        isFeatured,
        categoryId,
        gstId,
        variants: rawVariants,
      } = req.body;

      // Validate variants
      const variants = rawVariants || [];
      if (!Array.isArray(variants) || variants.length === 0) {
        throw new AppError(400, "At least one variant is required");
      }

      // Upload images to Cloudinary
      const files = (req.files as Express.Multer.File[]) || [];
      let imageResults: { url: string; public_id: string }[] = [];
      if (files.length > 0) {
        try {
          imageResults = await uploadToCloudinary(files);
          if (imageResults.length === 0) {
            throw new AppError(400, "Failed to upload images to Cloudinary");
          }
        } catch (error) {
          const uploadMessage = error instanceof Error ? error.message : String(error);
          logger.error(`[product.controller] createProduct Cloudinary upload failed: ${uploadMessage}`);
          if (error instanceof AppError) throw error;
          throw new AppError(400, "Failed to upload images to Cloudinary");
        }
      }

      // Process variants
      const processedVariants = variants.map((variant: any, index: number) => {
        // Parse JSON fields
        let attributes = [];
        let imageIndexes = [];
        try {
          attributes = JSON.parse(variant.attributes || "[]");
          imageIndexes = JSON.parse(variant.imageIndexes || "[]");
        } catch (error) {
          console.error(`Error parsing JSON for variant ${index}:`, error);
          throw new AppError(400, `Invalid JSON format in Variant #${index + 1}.`);
        }

        const parsedPrice = parseFloat(variant.price);
        const parsedDefaultDealerPrice =
          variant.defaultDealerPrice === undefined ||
          variant.defaultDealerPrice === null ||
          variant.defaultDealerPrice === ""
            ? null
            : Number(variant.defaultDealerPrice);

        if (
          parsedDefaultDealerPrice !== null &&
          (Number.isNaN(parsedDefaultDealerPrice) || parsedDefaultDealerPrice < 0)
        ) {
          throw new AppError(
            400,
            `Variant #${index + 1} dealer base price must be numeric and >= 0.`
          );
        }

        if (
          parsedDefaultDealerPrice !== null &&
          !Number.isNaN(parsedPrice) &&
          parsedDefaultDealerPrice > parsedPrice
        ) {
          throw new AppError(
            400,
            `Variant #${index + 1} dealer base price cannot exceed retail price.`
          );
        }

        // Map image URLs based on imageIndexes
        const imageUrls = imageIndexes
          .map((idx: number) => {
            if (idx >= 0 && idx < imageResults.length) {
              return imageResults[idx].url;
            }
            return null;
          })
          .filter((url: string | null) => url !== null);

        return {
          ...variant,
          price: parsedPrice,
          defaultDealerPrice: parsedDefaultDealerPrice,
          stock: parseInt(variant.stock, 10),
          lowStockThreshold: parseInt(variant.lowStockThreshold || "10", 10),
          attributes,
          images: imageUrls,
        };
      });

      // Create product
      const product = await this.productService.createProduct({
        name,
        description,
        isNew: isNew === "true",
        isTrending: isTrending === "true",
        isBestSeller: isBestSeller === "true",
        isFeatured: isFeatured === "true",
        categoryId,
        gstId: String(gstId ?? "").trim(),
        variants: processedVariants,
      });

      // Send response
      res.status(201).json({
        status: "success",
        data: { product },
        message: "Product created successfully",
      });
    }
  );

  updateProduct = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id: productId } = req.params;
      const {
        name,
        description,
        categoryId,
        gstId,
        isNew,
        isFeatured,
        isTrending,
        isBestSeller,
      } = req.body;
      const hasGstIdField = Object.prototype.hasOwnProperty.call(req.body, "gstId");
      const normalizedGstId = hasGstIdField ? String(gstId ?? "").trim() : undefined;

      // Parse variants from req.body
      let parsedVariants: any[] = [];
      for (const key in req.body) {
        if (key.startsWith("variants[")) {
          const match = key.match(/^variants\[(\d+)\]\[(\w+)\]$/);
          if (match) {
            const index = parseInt(match[1]);
            const field = match[2];
            if (!parsedVariants[index]) {
              parsedVariants[index] = {};
            }
            parsedVariants[index][field] = req.body[key];
          }
        }
      }
      parsedVariants = parsedVariants.filter(Boolean);

      if (parsedVariants.length === 0 && req.body.variants) {
        try {
          const variantsFromJson =
            typeof req.body.variants === "string"
              ? JSON.parse(req.body.variants)
              : req.body.variants;

          if (Array.isArray(variantsFromJson)) {
            parsedVariants = variantsFromJson;
          }
        } catch (error) {
          throw new AppError(400, "Invalid variants payload format");
        }
      }

      // Process files for each variant
      const files = (req.files as Express.Multer.File[]) || [];
      const processedVariants = parsedVariants.length
        ? await Promise.all(
            parsedVariants.map(async (variant: any, index: number) => {
              const variantLabel = `Variant #${index + 1}`;
              const parsedPrice = Number(variant.price);
              const parsedStock = Number.parseInt(String(variant.stock), 10);
              const parsedLowStockThreshold =
                variant.lowStockThreshold === undefined ||
                variant.lowStockThreshold === null ||
                variant.lowStockThreshold === ""
                  ? 10
                  : Number.parseInt(String(variant.lowStockThreshold), 10);
              const hasDefaultDealerPriceField = Object.prototype.hasOwnProperty.call(
                variant,
                "defaultDealerPrice"
              );
              const parsedDefaultDealerPrice = hasDefaultDealerPriceField
                ? variant.defaultDealerPrice === undefined ||
                  variant.defaultDealerPrice === null ||
                  variant.defaultDealerPrice === ""
                  ? null
                  : Number(variant.defaultDealerPrice)
                : undefined;

              if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
                throw new AppError(
                  400,
                  `${variantLabel} must have a valid positive price.`
                );
              }

              if (Number.isNaN(parsedStock) || parsedStock < 0) {
                throw new AppError(
                  400,
                  `${variantLabel} must have a valid non-negative stock number.`
                );
              }

              if (
                Number.isNaN(parsedLowStockThreshold) ||
                parsedLowStockThreshold < 0
              ) {
                throw new AppError(
                  400,
                  `${variantLabel} must have a valid non-negative low stock threshold.`
                );
              }

              if (
                parsedDefaultDealerPrice !== undefined &&
                parsedDefaultDealerPrice !== null &&
                (Number.isNaN(parsedDefaultDealerPrice) ||
                  parsedDefaultDealerPrice < 0)
              ) {
                throw new AppError(
                  400,
                  `${variantLabel} dealer base price must be numeric and >= 0.`
                );
              }

              if (
                parsedDefaultDealerPrice !== undefined &&
                parsedDefaultDealerPrice !== null &&
                parsedDefaultDealerPrice > parsedPrice
              ) {
                throw new AppError(
                  400,
                  `${variantLabel} dealer base price cannot exceed retail price.`
                );
              }

              // Validate images from req.body
              let bodyImages = variant.images || [];
              if (typeof bodyImages === "string") {
                try {
                  bodyImages = JSON.parse(bodyImages);
                } catch {
                  throw new AppError(
                    400,
                    `Invalid images format for ${variantLabel}.`
                  );
                }
              }
              if (
                !Array.isArray(bodyImages) ||
                bodyImages.some((img: any) => img && typeof img !== "string")
              ) {
                throw new AppError(
                  400,
                  `Images for ${variantLabel} must be an array of strings or empty.`
                );
              }

              const orderedImageEntries = (bodyImages as string[]).filter(
                (img: string) => Boolean(img)
              );
              const hasInlineFileTokens = orderedImageEntries.some((entry) =>
                entry.startsWith(UPLOADED_IMAGE_TOKEN_PREFIX)
              );

              let imageIndexes: number[] = [];
              try {
                const parsedImageIndexes = variant.imageIndexes
                  ? JSON.parse(variant.imageIndexes)
                  : [];
                imageIndexes = Array.isArray(parsedImageIndexes)
                  ? parsedImageIndexes
                  : [];
              } catch {
                imageIndexes = [];
              }

              const inlineFileIndexes = hasInlineFileTokens
                ? orderedImageEntries
                    .filter((entry) =>
                      entry.startsWith(UPLOADED_IMAGE_TOKEN_PREFIX)
                    )
                    .map((entry) =>
                      Number.parseInt(
                        entry.slice(UPLOADED_IMAGE_TOKEN_PREFIX.length),
                        10
                      )
                    )
                    .filter(
                      (idx) =>
                        Number.isInteger(idx) && idx >= 0 && idx < files.length
                    )
                : [];

              const requestedFileIndexes =
                inlineFileIndexes.length > 0
                  ? inlineFileIndexes
                  : imageIndexes.filter(
                      (idx) =>
                        Number.isInteger(idx) && idx >= 0 && idx < files.length
                    );
              const uniqueFileIndexes = [...new Set(requestedFileIndexes)];

              let uploadedImageUrlsByIndex = new Map<number, string>();
              let uploadedImageUrls: string[] = [];

              if (uniqueFileIndexes.length > 0) {
                const variantFiles = uniqueFileIndexes
                  .map((idx) => files[idx])
                  .filter(Boolean) as Express.Multer.File[];

                if (variantFiles.length > 0) {
                  let uploadedImages: { url: string; public_id: string }[] = [];
                  try {
                    uploadedImages = await uploadToCloudinary(variantFiles);
                  } catch (error) {
                    const uploadMessage = error instanceof Error ? error.message : String(error);
                    logger.error(`[product.controller] updateProduct Cloudinary upload failed (${variantLabel}): ${uploadMessage}`);
                    throw new AppError(
                      400,
                      `Failed to upload images to Cloudinary for ${variantLabel}.`
                    );
                  }

                  if (uploadedImages.length !== variantFiles.length) {
                    throw new AppError(
                      400,
                      `Only ${uploadedImages.length} of ${variantFiles.length} images uploaded for ${variantLabel}.`
                    );
                  }

                  uploadedImageUrls = uploadedImages
                    .map((img) => img.url)
                    .filter(Boolean);

                  uniqueFileIndexes.forEach((fileIndex, fileOrder) => {
                    const imageUrl = uploadedImageUrls[fileOrder];
                    if (imageUrl) {
                      uploadedImageUrlsByIndex.set(fileIndex, imageUrl);
                    }
                  });
                }
              } else {
                // Backward compatibility for legacy multipart field names.
                const legacyVariantFiles = files.filter((f) =>
                  f.fieldname.startsWith(`variants[${index}][images][`)
                );

                if (legacyVariantFiles.length > 0) {
                  let uploadedImages: { url: string; public_id: string }[] = [];
                  try {
                    uploadedImages = await uploadToCloudinary(legacyVariantFiles);
                  } catch (error) {
                    const legacyUploadMsg = error instanceof Error ? error.message : String(error);
                    logger.error(`[product.controller] updateProduct legacy Cloudinary upload failed (${variantLabel}): ${legacyUploadMsg}`);
                    throw new AppError(
                      400,
                      `Failed to upload images to Cloudinary for ${variantLabel}.`
                    );
                  }

                  if (uploadedImages.length !== legacyVariantFiles.length) {
                    throw new AppError(
                      400,
                      `Only ${uploadedImages.length} of ${legacyVariantFiles.length} images uploaded for ${variantLabel}.`
                    );
                  }

                  uploadedImageUrls = uploadedImages
                    .map((img) => img.url)
                    .filter(Boolean);
                }
              }

              const orderedUploadedUrls = hasInlineFileTokens
                ? inlineFileIndexes
                    .map((fileIndex) => uploadedImageUrlsByIndex.get(fileIndex))
                    .filter(
                      (imageUrl): imageUrl is string =>
                        typeof imageUrl === "string" && imageUrl.length > 0
                    )
                : requestedFileIndexes
                    .map((fileIndex) => uploadedImageUrlsByIndex.get(fileIndex))
                    .filter(
                      (imageUrl): imageUrl is string =>
                        typeof imageUrl === "string" && imageUrl.length > 0
                    );

              const imageUrls: string[] = hasInlineFileTokens
                ? orderedImageEntries
                    .map((entry) => {
                      if (entry.startsWith(UPLOADED_IMAGE_TOKEN_PREFIX)) {
                        const fileIndex = Number.parseInt(
                          entry.slice(UPLOADED_IMAGE_TOKEN_PREFIX.length),
                          10
                        );
                        return uploadedImageUrlsByIndex.get(fileIndex) || "";
                      }

                      return entry;
                    })
                    .filter(
                      (imageUrl): imageUrl is string =>
                        typeof imageUrl === "string" && imageUrl.length > 0
                    )
                : [
                    ...(orderedUploadedUrls.length > 0
                      ? orderedUploadedUrls
                      : uploadedImageUrls),
                    ...orderedImageEntries,
                  ].filter(
                    (imageUrl): imageUrl is string =>
                      typeof imageUrl === "string" && imageUrl.length > 0
                  );

              // Validate other fields
              if (
                !variant.sku ||
                Number.isNaN(parsedPrice) ||
                Number.isNaN(parsedStock)
              ) {
                throw new AppError(
                  400,
                  `${variantLabel} must have SKU, price, and stock.`
                );
              }

              // Validate attributes
              let parsedAttributes;
              try {
                parsedAttributes =
                  typeof variant.attributes === "string"
                    ? JSON.parse(variant.attributes)
                    : variant.attributes;
                if (!Array.isArray(parsedAttributes)) {
                  throw new AppError(
                    400,
                    `${variantLabel} must have an attributes array.`
                  );
                }
                parsedAttributes.forEach((attr: any, attrIndex: number) => {
                  if (!attr.attributeId || !attr.valueId) {
                    throw new AppError(
                      400,
                      `${variantLabel} has an invalid attribute structure at attribute #${
                        attrIndex + 1
                      }.`
                    );
                  }
                });
              } catch (error) {
                throw new AppError(
                  400,
                  `Invalid attributes format for ${variantLabel}.`
                );
              }

              // Check for duplicate attributes
              const attributeIds = parsedAttributes.map(
                (attr: any) => attr.attributeId
              );
              if (new Set(attributeIds).size !== attributeIds.length) {
                throw new AppError(
                  400,
                  `${variantLabel} has duplicate attributes.`
                );
              }

              return {
                ...variant,
                price: parsedPrice,
                ...(parsedDefaultDealerPrice !== undefined && {
                  defaultDealerPrice: parsedDefaultDealerPrice,
                }),
                stock: parsedStock,
                lowStockThreshold: parsedLowStockThreshold,
                images: imageUrls,
                attributes: parsedAttributes,
              };
            })
          )
        : undefined;

      const updatedData: any = {
        ...(name && { name, slug: slugify(name) }),
        ...(description && { description }),
        ...(isNew !== undefined && { isNew: isNew === "true" }),
        ...(isFeatured !== undefined && { isFeatured: isFeatured === "true" }),
        ...(isTrending !== undefined && { isTrending: isTrending === "true" }),
        ...(isBestSeller !== undefined && {
          isBestSeller: isBestSeller === "true",
        }),
        ...(categoryId && { categoryId }),
        ...(hasGstIdField && { gstId: normalizedGstId ?? "" }),
        ...(processedVariants && { variants: processedVariants }),
      };

      const { product, didChange } = await this.productService.updateProduct(
        productId,
        updatedData
      );

      sendResponse(res, 200, {
        data: { product, didChange },
        message: didChange ? "Product updated successfully" : "No changes detected.",
      });
      this.logsService.info(didChange ? "Product updated" : "Product update skipped (no changes)", {
        userId: req.user?.id,
        sessionId: req.session.id,
        didChange,
      });
    }
  );

  bulkCreateProducts = asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    const start = Date.now();
    const result = await this.productService.bulkCreateProducts(file!);

    this.logsService.info("Bulk Products created", {
      userId: req.user?.id,
      sessionId: req.session.id,
      timePeriod: Date.now() - start,
    });

    sendResponse(res, 201, {
      data: { count: result.count },
      message: `${result.count} products created successfully`,
    });
  });

  deleteProduct = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id: productId } = req.params;
      const start = Date.now();
      await this.productService.deleteProduct(productId);

      this.logsService.info("Product deleted", {
        userId: req.user?.id,
        sessionId: req.session.id,
        timePeriod: Date.now() - start,
      });

      sendResponse(res, 200, { message: "Product deleted successfully" });
    }
  );
}
