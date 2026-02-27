import AppError from "@/shared/errors/AppError";
import ApiFeatures from "@/shared/utils/ApiFeatures";
import { ProductRepository } from "./product.repository";
import slugify from "@/shared/utils/slugify";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import prisma from "@/infra/database/database.config";
import { AttributeRepository } from "../attribute/attribute.repository";
import { VariantRepository } from "../variant/variant.repository";
import { getDealerPriceMap } from "@/shared/utils/dealerAccess";

export class ProductService {
  constructor(
    private productRepository: ProductRepository,
    private attributeRepository: AttributeRepository,
    private variantRepository: VariantRepository
  ) {}

  private async applyDealerPricingToProduct(
    product: any,
    userId?: string
  ): Promise<any> {
    if (!product?.variants?.length) {
      return product;
    }

    const variantIds = product.variants.map((variant: any) => variant.id);
    const dealerPriceMap = await getDealerPriceMap(prisma, userId, variantIds);

    if (!dealerPriceMap.size) {
      return product;
    }

    product.variants = product.variants.map((variant: any) => ({
      ...variant,
      price: dealerPriceMap.get(variant.id) ?? variant.price,
    }));

    return product;
  }

  private async applyDealerPricingToProducts(
    products: any[],
    userId?: string
  ): Promise<any[]> {
    if (!products.length) {
      return products;
    }

    const variantIds = products.flatMap((product) =>
      Array.isArray(product.variants)
        ? product.variants.map((variant: any) => variant.id)
        : []
    );

    if (!variantIds.length) {
      return products;
    }

    const dealerPriceMap = await getDealerPriceMap(prisma, userId, variantIds);
    if (!dealerPriceMap.size) {
      return products;
    }

    return products.map((product) => ({
      ...product,
      variants: Array.isArray(product.variants)
        ? product.variants.map((variant: any) => ({
            ...variant,
            price: dealerPriceMap.get(variant.id) ?? variant.price,
          }))
        : product.variants,
    }));
  }

  async getAllProducts(queryString: Record<string, any>, userId?: string) {
    const apiFeatures = new ApiFeatures(queryString)
      .filter()
      .sort()
      .limitFields()
      .paginate()
      .build();

    const { where, orderBy, skip, take, select } = apiFeatures;

    const finalWhere = where && Object.keys(where).length > 0 ? where : {};

    const totalResults = await this.productRepository.countProducts({
      where: finalWhere,
    });

    const totalPages = Math.ceil(totalResults / take);
    const currentPage = Math.floor(skip / take) + 1;

    const products = await this.productRepository.findManyProducts({
      where: finalWhere,
      orderBy: orderBy || { createdAt: "desc" },
      skip,
      take,
      select,
    });

    const pricedProducts = await this.applyDealerPricingToProducts(
      products,
      userId
    );

    return {
      products: pricedProducts,
      totalResults,
      totalPages,
      currentPage,
      resultsPerPage: take,
    };
  }

  async getProductById(productId: string, userId?: string) {
    const product = await this.productRepository.findProductById(productId);
    if (!product) {
      throw new AppError(404, "Product not found");
    }
    return this.applyDealerPricingToProduct(product, userId);
  }

  async getProductBySlug(productSlug: string, userId?: string) {
    const product = await this.productRepository.findProductBySlug(productSlug);
    if (!product) {
      throw new AppError(404, "Product not found");
    }
    return this.applyDealerPricingToProduct(product, userId);
  }

  async createProduct(data: {
    name: string;
    description?: string;
    isNew?: boolean;
    isTrending?: boolean;
    isBestSeller?: boolean;
    isFeatured?: boolean;
    categoryId?: string;
    variants?: {
      sku: string;
      price: number;
      images: string[];
      stock: number;
      lowStockThreshold?: number;
      barcode?: string;
      attributes: { attributeId: string; valueId: string }[];
    }[];
  }) {
    const { variants, ...productData } = data;

    if (!variants || variants.length === 0) {
      throw new AppError(400, "At least one variant is required");
    }

    // Validate SKU format (alphanumeric with dashes, 3-50 characters)
    const skuRegex = /^[a-zA-Z0-9-]+$/;
    variants.forEach((variant, index) => {
      if (
        !variant.sku ||
        !skuRegex.test(variant.sku) ||
        variant.sku.length < 3 ||
        variant.sku.length > 50
      ) {
        throw new AppError(
          400,
          `Variant at index ${index} has invalid SKU. Use alphanumeric characters and dashes, 3-50 characters.`
        );
      }
      if (variant.price <= 0) {
        throw new AppError(
          400,
          `Variant at index ${index} must have a positive price`
        );
      }
      if (variant.stock < 0) {
        throw new AppError(
          400,
          `Variant at index ${index} must have non-negative stock`
        );
      }
      if (variant.lowStockThreshold && variant.lowStockThreshold < 0) {
        throw new AppError(
          400,
          `Variant at index ${index} must have non-negative lowStockThreshold`
        );
      }
    });

    // Validate category and required attributes
    let requiredAttributeIds: string[] = [];
    if (productData.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: productData.categoryId },
        include: {
          attributes: {
            where: { isRequired: true },
            select: { attributeId: true },
          },
        },
      });
      if (!category) {
        throw new AppError(404, "Category not found");
      }
      requiredAttributeIds = category.attributes.map(
        (attr) => attr.attributeId
      );
    }

    // Validate attributes and values in one query
    const allAttributeIds = [
      ...new Set(
        variants.flatMap((v) => v.attributes.map((a) => a.attributeId))
      ),
    ];
    const allValueIds = [
      ...new Set(variants.flatMap((v) => v.attributes.map((a) => a.valueId))),
    ];
    const [existingAttributes, existingValues] = await Promise.all([
      prisma.attribute.findMany({
        where: { id: { in: allAttributeIds } },
        select: { id: true },
      }),
      prisma.attributeValue.findMany({
        where: { id: { in: allValueIds } },
        select: { id: true, attributeId: true },
      }),
    ]);

    if (existingAttributes.length !== allAttributeIds.length) {
      throw new AppError(400, "One or more attribute IDs are invalid");
    }
    if (existingValues.length !== allValueIds.length) {
      throw new AppError(400, "One or more attribute value IDs are invalid");
    }

    // Validate attribute-value pairs
    variants.forEach((variant, index) => {
      variant.attributes.forEach((attr, attrIndex) => {
        const value = existingValues.find((v) => v.id === attr.valueId);
        if (!value || value.attributeId !== attr.attributeId) {
          throw new AppError(
            400,
            `Attribute value at variant index ${index}, attribute index ${attrIndex} does not belong to the specified attribute`
          );
        }
      });
    });

    // Validate unique SKUs
    const existingSkus = await prisma.productVariant.findMany({
      where: { sku: { in: variants.map((v) => v.sku) } },
      select: { sku: true },
    });
    if (existingSkus.length > 0) {
      throw new AppError(
        400,
        `Duplicate SKUs detected: ${existingSkus.map((s) => s.sku).join(", ")}`
      );
    }

    // Validate unique attribute combinations
    const comboKeys = variants.map((variant) =>
      variant.attributes
        .map((attr) => `${attr.attributeId}:${attr.valueId}`)
        .sort()
        .join("|")
    );
    if (new Set(comboKeys).size !== variants.length) {
      throw new AppError(400, "Duplicate attribute combinations detected");
    }

    // Validate required attributes
    variants.forEach((variant, index) => {
      const variantAttributeIds = variant.attributes.map(
        (attr) => attr.attributeId
      );
      const missingAttributes = requiredAttributeIds.filter(
        (id) => !variantAttributeIds.includes(id)
      );
      if (missingAttributes.length > 0) {
        throw new AppError(
          400,
          `Variant at index ${index} is missing required attributes: ${missingAttributes.join(
            ", "
          )}`
        );
      }
    });

    // Create product and variants in a transaction
    return prisma.$transaction(async (tx) => {
      const product = await this.productRepository.createProduct({
        ...productData,
        slug: slugify(productData.name),
      }, tx);

      for (const variant of variants) {
        await this.variantRepository.createVariant({
          productId: product.id,
          sku: variant.sku,
          price: variant.price,
          stock: variant.stock,
          lowStockThreshold: variant.lowStockThreshold || 10,
          barcode: variant.barcode,
          attributes: variant.attributes,
          images: variant.images || [],
        }, tx);
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          category: true,
          variants: {
            include: {
              attributes: {
                include: {
                  attribute: true,
                  value: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async updateProduct(
    productId: string,
    updatedData: Partial<{
      name: string;
      description?: string;
      isNew?: boolean;
      isTrending?: boolean;
      isBestSeller?: boolean;
      isFeatured?: boolean;
      categoryId?: string;
      variants?: {
        id?: string;
        sku: string;
        price: number;
        images: string[];
        stock: number;
        lowStockThreshold?: number;
        barcode?: string;
        attributes: { attributeId: string; valueId: string }[];
      }[];
    }>
  ) {
    const existingProduct = await this.productRepository.findProductById(
      productId
    );
    if (!existingProduct) {
      throw new AppError(404, "Product not found");
    }

    const { variants, ...productData } = updatedData;

    // Validate variants if provided
    if (variants) {
      if (variants.length === 0) {
        throw new AppError(400, "At least one variant is required");
      }

      const skuRegex = /^[a-zA-Z0-9-]+$/;
      variants.forEach((variant, index) => {
        if (
          !variant.sku ||
          !skuRegex.test(variant.sku) ||
          variant.sku.length < 3 ||
          variant.sku.length > 50
        ) {
          throw new AppError(
            400,
            `Variant at index ${index} has an invalid SKU. Use alphanumeric characters and dashes, 3-50 characters.`
          );
        }
        if (variant.price <= 0) {
          throw new AppError(
            400,
            `Variant at index ${index} must have a positive price`
          );
        }
        if (variant.stock < 0) {
          throw new AppError(
            400,
            `Variant at index ${index} must have a non-negative stock`
          );
        }
        if (variant.lowStockThreshold && variant.lowStockThreshold < 0) {
          throw new AppError(
            400,
            `Variant at index ${index} must have a non-negative lowStockThreshold`
          );
        }
      });

      const allAttributeIds = [
        ...new Set(
          variants.flatMap((v) => v.attributes.map((a) => a.attributeId))
        ),
      ];
      const existingAttributes = await prisma.attribute.findMany({
        where: { id: { in: allAttributeIds } },
      });
      if (existingAttributes.length !== allAttributeIds.length) {
        throw new AppError(400, "One or more attributes are invalid");
      }

      const allValueIds = [
        ...new Set(variants.flatMap((v) => v.attributes.map((a) => a.valueId))),
      ];
      const existingValues = await prisma.attributeValue.findMany({
        where: { id: { in: allValueIds } },
      });
      if (existingValues.length !== allValueIds.length) {
        throw new AppError(400, "One or more attribute values are invalid");
      }

      const skuSet = new Set(variants.map((v) => v.sku));
      if (skuSet.size !== variants.length) {
        throw new AppError(400, "Duplicate SKUs detected");
      }

      const existingVariantIds = existingProduct.variants.map((v) => v.id);
      const incomingSkus = variants.map((variant) => variant.sku);
      const conflictingSkus = await prisma.productVariant.findMany({
        where: {
          sku: { in: incomingSkus },
          id: { notIn: existingVariantIds },
        },
        select: { sku: true },
      });

      if (conflictingSkus.length > 0) {
        throw new AppError(
          400,
          `Duplicate SKUs detected: ${conflictingSkus
            .map((variant) => variant.sku)
            .join(", ")}`
        );
      }

      const comboKeys = variants.map((variant) =>
        variant.attributes
          .map((attr) => `${attr.attributeId}:${attr.valueId}`)
          .sort()
          .join("|")
      );
      if (new Set(comboKeys).size !== variants.length) {
        throw new AppError(400, "Duplicate attribute combinations detected");
      }

      const categoryId = productData.categoryId || existingProduct.categoryId;
      let requiredAttributeIds: string[] = [];
      if (categoryId) {
        const requiredAttributes = await prisma.categoryAttribute.findMany({
          where: { categoryId, isRequired: true },
          select: { attributeId: true },
        });
        requiredAttributeIds = requiredAttributes.map(
          (attr) => attr.attributeId
        );
      }

      variants.forEach((variant, index) => {
        const variantAttributeIds = variant.attributes.map(
          (attr) => attr.attributeId
        );
        const missingAttributes = requiredAttributeIds.filter(
          (id) => !variantAttributeIds.includes(id)
        );
        if (missingAttributes.length > 0) {
          throw new AppError(
            400,
            `Variant at index ${index} is missing required attributes: ${missingAttributes.join(
              ", "
            )}`
          );
        }
      });
    }

    return prisma.$transaction(async (tx) => {
      await this.productRepository.updateProduct(
        productId,
        {
          ...productData,
          ...(productData.name && { slug: slugify(productData.name) }),
        },
        tx
      );

      if (variants) {
        const existingVariants = await tx.productVariant.findMany({
          where: { productId },
          select: { id: true, sku: true },
        });

        const existingVariantById = new Map(
          existingVariants.map((variant) => [variant.id, variant])
        );
        const existingVariantBySku = new Map(
          existingVariants.map((variant) => [variant.sku, variant])
        );
        const retainedVariantIds = new Set<string>();

        for (const variant of variants) {
          const hasExplicitId =
            typeof variant.id === "string" && variant.id.trim().length > 0;
          const existingVariant = hasExplicitId
            ? existingVariantById.get(variant.id as string)
            : existingVariantBySku.get(variant.sku);

          if (existingVariant) {
            retainedVariantIds.add(existingVariant.id);

            await tx.productVariant.update({
              where: { id: existingVariant.id },
              data: {
                sku: variant.sku,
                price: variant.price,
                stock: variant.stock,
                lowStockThreshold: variant.lowStockThreshold || 10,
                barcode: variant.barcode || null,
                images: variant.images || [],
              },
            });

            await tx.productVariantAttribute.deleteMany({
              where: { variantId: existingVariant.id },
            });

            if (variant.attributes.length > 0) {
              await tx.productVariantAttribute.createMany({
                data: variant.attributes.map((attribute) => ({
                  variantId: existingVariant.id,
                  attributeId: attribute.attributeId,
                  valueId: attribute.valueId,
                })),
              });
            }

            continue;
          }

          const createdVariant = await this.variantRepository.createVariant(
            {
              productId,
              sku: variant.sku,
              price: variant.price,
              stock: variant.stock,
              lowStockThreshold: variant.lowStockThreshold || 10,
              barcode: variant.barcode,
              attributes: variant.attributes,
              images: variant.images || [],
            },
            tx
          );

          retainedVariantIds.add(createdVariant.id);
        }

        const removedVariantIds = existingVariants
          .map((variant) => variant.id)
          .filter((variantId) => !retainedVariantIds.has(variantId));

        if (removedVariantIds.length > 0) {
          const referencedOrderItems = await tx.orderItem.groupBy({
            by: ["variantId"],
            where: { variantId: { in: removedVariantIds } },
            _count: { _all: true },
          });

          if (referencedOrderItems.length > 0) {
            const referencedVariantSku = referencedOrderItems
              .map(
                (row) =>
                  existingVariants.find((variant) => variant.id === row.variantId)
                    ?.sku
              )
              .filter(Boolean) as string[];

            throw new AppError(
              400,
              `Cannot remove variants already used in orders (${referencedVariantSku.join(
                ", "
              )}). Keep them and set stock to 0 if discontinued.`
            );
          }

          await tx.productVariant.deleteMany({
            where: { id: { in: removedVariantIds } },
          });
        }
      }

      return tx.product.findUnique({
        where: { id: productId },
        include: {
          category: true,
          variants: {
            include: {
              attributes: {
                include: {
                  attribute: true,
                  value: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async bulkCreateProducts(file: Express.Multer.File) {
    if (!file) {
      throw new AppError(400, "No file uploaded");
    }

    let records: any[];
    try {
      if (file.mimetype === "text/csv") {
        records = parse(file.buffer.toString(), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } else if (
        file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ) {
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        records = XLSX.utils.sheet_to_json(sheet);
      } else {
        throw new AppError(400, "Unsupported file format. Use CSV or XLSX");
      }
    } catch (error) {
      throw new AppError(400, "Failed to parse file");
    }

    if (records.length === 0) {
      throw new AppError(400, "File is empty");
    }

    const parseBoolean = (value: unknown) =>
      value === true ||
      value === "true" ||
      value === "TRUE" ||
      value === 1 ||
      value === "1";

    const rows = records.map((record, index) => {
      const name = record.name ? String(record.name).trim() : "";
      const sku = record.sku ? String(record.sku).trim() : "";
      const price = Number(record.price);
      const stock = Number.parseInt(String(record.stock), 10);
      const lowStockThresholdRaw =
        record.lowStockThreshold === undefined ||
        record.lowStockThreshold === null ||
        record.lowStockThreshold === ""
          ? 10
          : Number.parseInt(String(record.lowStockThreshold), 10);

      if (!name || !sku || Number.isNaN(price) || Number.isNaN(stock)) {
        throw new AppError(
          400,
          `Invalid record at row ${index + 1}. Required columns: name, sku, price, stock.`
        );
      }

      if (price <= 0) {
        throw new AppError(
          400,
          `Invalid price at row ${index + 1}. Price must be greater than 0.`
        );
      }

      if (stock < 0) {
        throw new AppError(
          400,
          `Invalid stock at row ${index + 1}. Stock must be non-negative.`
        );
      }

      if (Number.isNaN(lowStockThresholdRaw) || lowStockThresholdRaw < 0) {
        throw new AppError(
          400,
          `Invalid lowStockThreshold at row ${index + 1}.`
        );
      }

      return {
        name,
        slug: slugify(name),
        description: record.description
          ? String(record.description)
          : undefined,
        categoryId: record.categoryId ? String(record.categoryId) : undefined,
        isNew: parseBoolean(record.isNew),
        isTrending: parseBoolean(record.isTrending),
        isBestSeller: parseBoolean(record.isBestSeller),
        isFeatured: parseBoolean(record.isFeatured),
        sku,
        price,
        stock,
        lowStockThreshold: lowStockThresholdRaw,
      };
    });

    const categoryIds = rows
      .filter((row) => row.categoryId)
      .map((row) => row.categoryId!);
    if (categoryIds.length > 0) {
      const existingCategories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true },
      });
      const validCategoryIds = new Set(existingCategories.map((c) => c.id));
      for (const row of rows) {
        if (row.categoryId && !validCategoryIds.has(row.categoryId)) {
          throw new AppError(400, `Invalid categoryId: ${row.categoryId}`);
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let createdVariants = 0;
      let skippedVariants = 0;
      const productIdCache = new Map<string, string>();

      for (const row of rows) {
        const existingVariant = await tx.productVariant.findUnique({
          where: { sku: row.sku },
          select: { id: true },
        });

        if (existingVariant) {
          skippedVariants += 1;
          continue;
        }

        let productId = productIdCache.get(row.name);
        if (!productId) {
          const existingProduct = await tx.product.findUnique({
            where: { name: row.name },
            select: { id: true },
          });

          if (existingProduct) {
            productId = existingProduct.id;
          } else {
            const createdProduct = await tx.product.create({
              data: {
                name: row.name,
                slug: row.slug,
                description: row.description,
                categoryId: row.categoryId,
                isNew: row.isNew,
                isTrending: row.isTrending,
                isBestSeller: row.isBestSeller,
                isFeatured: row.isFeatured,
              },
              select: { id: true },
            });
            productId = createdProduct.id;
          }

          productIdCache.set(row.name, productId);
        }

        await tx.productVariant.create({
          data: {
            productId,
            sku: row.sku,
            price: row.price,
            stock: row.stock,
            lowStockThreshold: row.lowStockThreshold,
            images: [],
          },
        });

        createdVariants += 1;
      }

      return { createdVariants, skippedVariants };
    });

    return { count: result.createdVariants, skipped: result.skippedVariants };
  }

  async deleteProduct(productId: string) {
    const product = await this.productRepository.findProductById(productId);
    if (!product) {
      throw new AppError(404, "Product not found");
    }

    await this.productRepository.deleteProduct(productId);
  }
}
