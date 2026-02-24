"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductController = void 0;
const asyncHandler_1 = __importDefault(require("@/shared/utils/asyncHandler"));
const sendResponse_1 = __importDefault(require("@/shared/utils/sendResponse"));
const slugify_1 = __importDefault(require("@/shared/utils/slugify"));
const logs_factory_1 = require("../logs/logs.factory");
const uploadToCloudinary_1 = require("@/shared/utils/uploadToCloudinary");
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const UPLOADED_IMAGE_TOKEN_PREFIX = "__UPLOADED_FILE_INDEX__";
class ProductController {
    constructor(productService) {
        this.productService = productService;
        this.logsService = (0, logs_factory_1.makeLogsService)();
        this.getAllProducts = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { products, totalResults, totalPages, currentPage, resultsPerPage, } = yield this.productService.getAllProducts(req.query);
            (0, sendResponse_1.default)(res, 200, {
                data: {
                    products,
                    totalResults,
                    totalPages,
                    currentPage,
                    resultsPerPage,
                },
                message: "Products fetched successfully",
            });
        }));
        this.getProductById = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id: productId } = req.params;
            const product = yield this.productService.getProductById(productId);
            (0, sendResponse_1.default)(res, 200, {
                data: product,
                message: "Product fetched successfully",
            });
        }));
        this.getProductBySlug = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { slug: productSlug } = req.params;
            const product = yield this.productService.getProductBySlug(productSlug);
            (0, sendResponse_1.default)(res, 200, {
                data: product,
                message: "Product fetched successfully",
            });
        }));
        this.createProduct = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { name, description, isNew, isTrending, isBestSeller, isFeatured, categoryId, variants: rawVariants, } = req.body;
            // Validate variants
            const variants = rawVariants || [];
            if (!Array.isArray(variants) || variants.length === 0) {
                throw new AppError_1.default(400, "At least one variant is required");
            }
            // Upload images to Cloudinary
            const files = req.files || [];
            let imageResults = [];
            if (files.length > 0) {
                try {
                    imageResults = yield (0, uploadToCloudinary_1.uploadToCloudinary)(files);
                    if (imageResults.length === 0) {
                        throw new AppError_1.default(400, "Failed to upload images to Cloudinary");
                    }
                }
                catch (error) {
                    console.error("Cloudinary upload error:", error);
                    throw new AppError_1.default(400, "Failed to upload images to Cloudinary");
                }
            }
            // Process variants
            const processedVariants = variants.map((variant, index) => {
                // Parse JSON fields
                let attributes = [];
                let imageIndexes = [];
                try {
                    attributes = JSON.parse(variant.attributes || "[]");
                    imageIndexes = JSON.parse(variant.imageIndexes || "[]");
                }
                catch (error) {
                    console.error(`Error parsing JSON for variant ${index}:`, error);
                    throw new AppError_1.default(400, `Invalid JSON format in variant ${index}`);
                }
                // Map image URLs based on imageIndexes
                const imageUrls = imageIndexes
                    .map((idx) => {
                    if (idx >= 0 && idx < imageResults.length) {
                        return imageResults[idx].url;
                    }
                    return null;
                })
                    .filter((url) => url !== null);
                return Object.assign(Object.assign({}, variant), { price: parseFloat(variant.price), stock: parseInt(variant.stock, 10), lowStockThreshold: parseInt(variant.lowStockThreshold || "10", 10), attributes, images: imageUrls });
            });
            // Create product
            const product = yield this.productService.createProduct({
                name,
                description,
                isNew: isNew === "true",
                isTrending: isTrending === "true",
                isBestSeller: isBestSeller === "true",
                isFeatured: isFeatured === "true",
                categoryId,
                variants: processedVariants,
            });
            // Send response
            res.status(201).json({
                status: "success",
                data: { product },
                message: "Product created successfully",
            });
        }));
        this.updateProduct = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id: productId } = req.params;
            const { name, description, categoryId, isNew, isFeatured, isTrending, isBestSeller, } = req.body;
            // Parse variants from req.body
            let parsedVariants = [];
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
                    const variantsFromJson = typeof req.body.variants === "string"
                        ? JSON.parse(req.body.variants)
                        : req.body.variants;
                    if (Array.isArray(variantsFromJson)) {
                        parsedVariants = variantsFromJson;
                    }
                }
                catch (error) {
                    throw new AppError_1.default(400, "Invalid variants payload format");
                }
            }
            // Process files for each variant
            const files = req.files || [];
            const processedVariants = parsedVariants.length
                ? yield Promise.all(parsedVariants.map((variant, index) => __awaiter(this, void 0, void 0, function* () {
                    const parsedPrice = Number(variant.price);
                    const parsedStock = Number.parseInt(String(variant.stock), 10);
                    const parsedLowStockThreshold = variant.lowStockThreshold === undefined ||
                        variant.lowStockThreshold === null ||
                        variant.lowStockThreshold === ""
                        ? 10
                        : Number.parseInt(String(variant.lowStockThreshold), 10);
                    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
                        throw new AppError_1.default(400, `Variant at index ${index} must have a valid positive price`);
                    }
                    if (Number.isNaN(parsedStock) || parsedStock < 0) {
                        throw new AppError_1.default(400, `Variant at index ${index} must have a valid non-negative stock number`);
                    }
                    if (Number.isNaN(parsedLowStockThreshold) ||
                        parsedLowStockThreshold < 0) {
                        throw new AppError_1.default(400, `Variant at index ${index} must have a valid non-negative low stock threshold`);
                    }
                    // Validate images from req.body
                    let bodyImages = variant.images || [];
                    if (typeof bodyImages === "string") {
                        try {
                            bodyImages = JSON.parse(bodyImages);
                        }
                        catch (_a) {
                            throw new AppError_1.default(400, `Invalid images format at variant index ${index}`);
                        }
                    }
                    if (!Array.isArray(bodyImages) ||
                        bodyImages.some((img) => img && typeof img !== "string")) {
                        throw new AppError_1.default(400, `Images at variant index ${index} must be an array of strings or empty`);
                    }
                    const orderedImageEntries = bodyImages.filter((img) => Boolean(img));
                    const hasInlineFileTokens = orderedImageEntries.some((entry) => entry.startsWith(UPLOADED_IMAGE_TOKEN_PREFIX));
                    let imageIndexes = [];
                    try {
                        const parsedImageIndexes = variant.imageIndexes
                            ? JSON.parse(variant.imageIndexes)
                            : [];
                        imageIndexes = Array.isArray(parsedImageIndexes)
                            ? parsedImageIndexes
                            : [];
                    }
                    catch (_b) {
                        imageIndexes = [];
                    }
                    const inlineFileIndexes = hasInlineFileTokens
                        ? orderedImageEntries
                            .filter((entry) => entry.startsWith(UPLOADED_IMAGE_TOKEN_PREFIX))
                            .map((entry) => Number.parseInt(entry.slice(UPLOADED_IMAGE_TOKEN_PREFIX.length), 10))
                            .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < files.length)
                        : [];
                    const requestedFileIndexes = inlineFileIndexes.length > 0
                        ? inlineFileIndexes
                        : imageIndexes.filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < files.length);
                    const uniqueFileIndexes = [...new Set(requestedFileIndexes)];
                    let uploadedImageUrlsByIndex = new Map();
                    let uploadedImageUrls = [];
                    if (uniqueFileIndexes.length > 0) {
                        const variantFiles = uniqueFileIndexes
                            .map((idx) => files[idx])
                            .filter(Boolean);
                        if (variantFiles.length > 0) {
                            const uploadedImages = yield (0, uploadToCloudinary_1.uploadToCloudinary)(variantFiles);
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
                    }
                    else {
                        // Backward compatibility for legacy multipart field names.
                        const legacyVariantFiles = files.filter((f) => f.fieldname.startsWith(`variants[${index}][images][`));
                        if (legacyVariantFiles.length > 0) {
                            const uploadedImages = yield (0, uploadToCloudinary_1.uploadToCloudinary)(legacyVariantFiles);
                            uploadedImageUrls = uploadedImages
                                .map((img) => img.url)
                                .filter(Boolean);
                        }
                    }
                    const orderedUploadedUrls = hasInlineFileTokens
                        ? inlineFileIndexes
                            .map((fileIndex) => uploadedImageUrlsByIndex.get(fileIndex))
                            .filter((imageUrl) => typeof imageUrl === "string" && imageUrl.length > 0)
                        : requestedFileIndexes
                            .map((fileIndex) => uploadedImageUrlsByIndex.get(fileIndex))
                            .filter((imageUrl) => typeof imageUrl === "string" && imageUrl.length > 0);
                    const imageUrls = hasInlineFileTokens
                        ? orderedImageEntries
                            .map((entry) => {
                            if (entry.startsWith(UPLOADED_IMAGE_TOKEN_PREFIX)) {
                                const fileIndex = Number.parseInt(entry.slice(UPLOADED_IMAGE_TOKEN_PREFIX.length), 10);
                                return uploadedImageUrlsByIndex.get(fileIndex) || "";
                            }
                            return entry;
                        })
                            .filter((imageUrl) => typeof imageUrl === "string" && imageUrl.length > 0)
                        : [
                            ...(orderedUploadedUrls.length > 0
                                ? orderedUploadedUrls
                                : uploadedImageUrls),
                            ...orderedImageEntries,
                        ].filter((imageUrl) => typeof imageUrl === "string" && imageUrl.length > 0);
                    // Validate other fields
                    if (!variant.sku ||
                        Number.isNaN(parsedPrice) ||
                        Number.isNaN(parsedStock)) {
                        throw new AppError_1.default(400, `Variant at index ${index} must have sku, price, and stock`);
                    }
                    // Validate attributes
                    let parsedAttributes;
                    try {
                        parsedAttributes =
                            typeof variant.attributes === "string"
                                ? JSON.parse(variant.attributes)
                                : variant.attributes;
                        if (!Array.isArray(parsedAttributes)) {
                            throw new AppError_1.default(400, `Variant at index ${index} must have an attributes array`);
                        }
                        parsedAttributes.forEach((attr, attrIndex) => {
                            if (!attr.attributeId || !attr.valueId) {
                                throw new AppError_1.default(400, `Invalid attribute structure in variant at index ${index}, attribute index ${attrIndex}`);
                            }
                        });
                    }
                    catch (error) {
                        throw new AppError_1.default(400, `Invalid attributes format at index ${index}`);
                    }
                    // Check for duplicate attributes
                    const attributeIds = parsedAttributes.map((attr) => attr.attributeId);
                    if (new Set(attributeIds).size !== attributeIds.length) {
                        throw new AppError_1.default(400, `Duplicate attributes in variant at index ${index}`);
                    }
                    return Object.assign(Object.assign({}, variant), { price: parsedPrice, stock: parsedStock, lowStockThreshold: parsedLowStockThreshold, images: imageUrls, attributes: parsedAttributes });
                })))
                : undefined;
            if (processedVariants) {
                // Check for duplicate SKUs
                const skuKeys = processedVariants.map((variant) => variant.sku);
                if (new Set(skuKeys).size !== skuKeys.length) {
                    throw new AppError_1.default(400, "Duplicate SKUs detected");
                }
                // Check for duplicate attribute combinations
                const comboKeys = processedVariants.map((variant) => variant.attributes
                    .map((attr) => `${attr.attributeId}:${attr.valueId}`)
                    .sort()
                    .join("|"));
                if (new Set(comboKeys).size !== comboKeys.length) {
                    throw new AppError_1.default(400, "Duplicate attribute combinations detected");
                }
            }
            const updatedData = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (name && { name, slug: (0, slugify_1.default)(name) })), (description && { description })), (isNew !== undefined && { isNew: isNew === "true" })), (isFeatured !== undefined && { isFeatured: isFeatured === "true" })), (isTrending !== undefined && { isTrending: isTrending === "true" })), (isBestSeller !== undefined && {
                isBestSeller: isBestSeller === "true",
            })), (categoryId && { categoryId })), (processedVariants && { variants: processedVariants }));
            const product = yield this.productService.updateProduct(productId, updatedData);
            (0, sendResponse_1.default)(res, 200, {
                data: { product },
                message: "Product updated successfully",
            });
            this.logsService.info("Product updated", {
                userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                sessionId: req.session.id,
            });
        }));
        this.bulkCreateProducts = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const file = req.file;
            const result = yield this.productService.bulkCreateProducts(file);
            (0, sendResponse_1.default)(res, 201, {
                data: { count: result.count },
                message: `${result.count} products created successfully`,
            });
            const start = Date.now();
            const end = Date.now();
            this.logsService.info("Bulk Products created", {
                userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                sessionId: req.session.id,
                timePeriod: end - start,
            });
        }));
        this.deleteProduct = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id: productId } = req.params;
            yield this.productService.deleteProduct(productId);
            (0, sendResponse_1.default)(res, 200, { message: "Product deleted successfully" });
            const start = Date.now();
            const end = Date.now();
            this.logsService.info("Product deleted", {
                userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                sessionId: req.session.id,
                timePeriod: end - start,
            });
        }));
    }
}
exports.ProductController = ProductController;
