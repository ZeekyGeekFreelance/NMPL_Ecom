import AppError from "@/shared/errors/AppError";
import ApiFeatures from "@/shared/utils/ApiFeatures";
import { ProductRepository } from "./product.repository";
import slugify from "@/shared/utils/slugify";
import prisma from "@/infra/database/database.config";
import { AttributeRepository } from "../attribute/attribute.repository";
import { VariantRepository } from "../variant/variant.repository";
import { getDealerPriceMap } from "@/shared/utils/dealerAccess";
import { clearCatalogListingCache } from "@/shared/utils/catalogCache";
import { normalizeHumanTextForField } from "@/shared/utils/textNormalization";
import { VariantValidationService } from "./variant-validation.service";
import { BulkImportService } from "./bulk-import.service";

export class ProductService {
  private static readonly BASE_VARIANT_DELETE_MESSAGE =
    "Base variant cannot be deleted. Add another variant first or delete the product instead.";

  private readonly variantValidator = new VariantValidationService();
  private readonly bulkImporter = new BulkImportService();

  constructor(
    private productRepository: ProductRepository,
    private attributeRepository: AttributeRepository,
    private variantRepository: VariantRepository
  ) {}

  private buildVariantValidationError(message: string): AppError {
    return new AppError(400, message, true, [
      {
        property: "variants",
        constraints: {
          integrity: message,
        },
      },
    ]);
  }

  private toVariantLabel(index: number): string {
    return `Variant #${index + 1}`;
  }

  private buildCombinationKey(
    attributes: Array<{ attributeId: string; valueId: string }>
  ): string {
    return attributes
      .map((attr) => `${attr.attributeId}:${attr.valueId}`)
      .sort()
      .join("|");
  }

  private describeAttributeCombination(
    attributes: Array<{ attributeId: string; valueId: string }>,
    attributeNameById: Map<string, string>,
    valueLabelById: Map<string, string>
  ): string {
    const normalized = attributes
      .map((attr) => {
        const attributeName = attributeNameById.get(attr.attributeId) || "Attribute";
        const valueLabel = valueLabelById.get(attr.valueId) || "Value";
        return `${attributeName} = ${valueLabel}`;
      })
      .sort((a, b) => a.localeCompare(b));

    return normalized.join(", ");
  }

  private findDuplicateCombinationMessage(
    variants: Array<{
      attributes: Array<{ attributeId: string; valueId: string }>;
    }>,
    attributeNameById: Map<string, string>,
    valueLabelById: Map<string, string>
  ): string | null {
    const seenCombinationByKey = new Map<string, number>();

    for (let index = 0; index < variants.length; index += 1) {
      const comboKey = this.buildCombinationKey(variants[index].attributes);
      const existingIndex = seenCombinationByKey.get(comboKey);
      if (existingIndex !== undefined) {
        const readableCombination = this.describeAttributeCombination(
          variants[index].attributes,
          attributeNameById,
          valueLabelById
        );
        if (readableCombination) {
          return `Duplicate attribute combination: ${readableCombination} already exists.`;
        }

        return `${this.toVariantLabel(index)} has the same attribute combination as ${this.toVariantLabel(
          existingIndex
        )}.`;
      }

      seenCombinationByKey.set(comboKey, index);
    }

    return null;
  }

  private areStringArraysEqual(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }

    return true;
  }

  private areAttributePairsEqual(
    left: Array<{ attributeId: string; valueId: string }>,
    right: Array<{ attributeId: string; valueId: string }>
  ): boolean {
    const leftKey = this.buildCombinationKey(left);
    const rightKey = this.buildCombinationKey(right);
    return leftKey === rightKey;
  }

  private hasProductFieldChanges(
    existingProduct: {
      name: string;
      description: string | null;
      isNew: boolean;
      isTrending: boolean;
      isBestSeller: boolean;
      isFeatured: boolean;
      categoryId: string | null;
    },
    productData: Partial<{
      name: string;
      description?: string;
      isNew?: boolean;
      isTrending?: boolean;
      isBestSeller?: boolean;
      isFeatured?: boolean;
      categoryId?: string;
    }>
  ): boolean {
    if (productData.name !== undefined && productData.name !== existingProduct.name) {
      return true;
    }
    if (
      productData.description !== undefined &&
      (productData.description ?? null) !== existingProduct.description
    ) {
      return true;
    }
    if (productData.isNew !== undefined && productData.isNew !== existingProduct.isNew) {
      return true;
    }
    if (
      productData.isTrending !== undefined &&
      productData.isTrending !== existingProduct.isTrending
    ) {
      return true;
    }
    if (
      productData.isBestSeller !== undefined &&
      productData.isBestSeller !== existingProduct.isBestSeller
    ) {
      return true;
    }
    if (
      productData.isFeatured !== undefined &&
      productData.isFeatured !== existingProduct.isFeatured
    ) {
      return true;
    }
    if (
      productData.categoryId !== undefined &&
      (productData.categoryId ?? null) !== existingProduct.categoryId
    ) {
      return true;
    }

    return false;
  }

  private hasVariantCollectionChanges(
    existingVariants: Array<{
      id: string;
      sku: string;
      price: number;
      defaultDealerPrice?: number | null;
      stock: number;
      lowStockThreshold: number;
      barcode?: string | null;
      images?: string[];
      attributes: Array<{ attributeId: string; valueId: string }>;
    }>,
    incomingVariants: Array<{
      id?: string;
      sku: string;
      price: number;
      defaultDealerPrice?: number | null;
      stock: number;
      lowStockThreshold?: number;
      barcode?: string;
      images: string[];
      attributes: { attributeId: string; valueId: string }[];
    }>
  ): boolean {
    const existingById = new Map(existingVariants.map((variant) => [variant.id, variant]));
    const existingBySku = new Map(existingVariants.map((variant) => [variant.sku, variant]));
    const retainedVariantIds = new Set<string>();

    for (const incomingVariant of incomingVariants) {
      const hasExplicitId =
        typeof incomingVariant.id === "string" && incomingVariant.id.trim().length > 0;

      const matchedExisting = hasExplicitId
        ? existingById.get(incomingVariant.id as string)
        : existingBySku.get(incomingVariant.sku);

      if (!matchedExisting) {
        return true;
      }

      retainedVariantIds.add(matchedExisting.id);

      if (matchedExisting.sku !== incomingVariant.sku) {
        return true;
      }
      if (Number(matchedExisting.price) !== Number(incomingVariant.price)) {
        return true;
      }
      const existingDefaultDealerPrice = matchedExisting.defaultDealerPrice ?? null;
      const incomingDefaultDealerPrice =
        incomingVariant.defaultDealerPrice === undefined
          ? existingDefaultDealerPrice
          : incomingVariant.defaultDealerPrice ?? null;
      if (existingDefaultDealerPrice !== incomingDefaultDealerPrice) {
        return true;
      }
      if (Number(matchedExisting.stock) !== Number(incomingVariant.stock)) {
        return true;
      }
      if (
        Number(matchedExisting.lowStockThreshold ?? 10) !==
        Number(incomingVariant.lowStockThreshold ?? 10)
      ) {
        return true;
      }

      const existingBarcode = matchedExisting.barcode || null;
      const incomingBarcode = incomingVariant.barcode || null;
      if (existingBarcode !== incomingBarcode) {
        return true;
      }

      const existingImages = Array.isArray(matchedExisting.images)
        ? matchedExisting.images
        : [];
      const incomingImages = Array.isArray(incomingVariant.images)
        ? incomingVariant.images.filter((image) => typeof image === "string" && image.length > 0)
        : [];

      if (!this.areStringArraysEqual(existingImages, incomingImages)) {
        return true;
      }

      const existingAttributes = matchedExisting.attributes.map((attribute) => ({
        attributeId: attribute.attributeId,
        valueId: attribute.valueId,
      }));

      if (!this.areAttributePairsEqual(existingAttributes, incomingVariant.attributes)) {
        return true;
      }
    }

    const removedVariantCount = existingVariants.filter(
      (variant) => !retainedVariantIds.has(variant.id)
    ).length;

    return removedVariantCount > 0;
  }

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
      defaultDealerPrice?: number | null;
      images: string[];
      stock: number;
      lowStockThreshold?: number;
      barcode?: string;
      attributes: { attributeId: string; valueId: string }[];
    }[];
  }) {
    const { variants, ...productData } = data;
    const normalizedProductData = {
      ...productData,
      name: normalizeHumanTextForField(productData.name, "name"),
    };

    if (!variants || variants.length === 0) {
      throw new AppError(400, "At least one variant is required");
    }

    // Validate SKU format (alphanumeric with dashes, 3-50 characters)
    const skuRegex = /^[a-zA-Z0-9-]+$/;
    variants.forEach((variant, index) => {
      const variantLabel = this.toVariantLabel(index);
      if (
        !variant.sku ||
        !skuRegex.test(variant.sku) ||
        variant.sku.length < 3 ||
        variant.sku.length > 50
      ) {
        throw this.buildVariantValidationError(
          `${variantLabel} has an invalid SKU. Use alphanumeric characters and dashes, 3-50 characters.`
        );
      }
      if (variant.price <= 0) {
        throw this.buildVariantValidationError(
          `${variantLabel} must have a positive price.`
        );
      }
      if (
        variant.defaultDealerPrice !== undefined &&
        variant.defaultDealerPrice !== null
      ) {
        if (Number.isNaN(Number(variant.defaultDealerPrice))) {
          throw this.buildVariantValidationError(
            `${variantLabel} dealer base price must be numeric.`
          );
        }
        if (Number(variant.defaultDealerPrice) < 0) {
          throw this.buildVariantValidationError(
            `${variantLabel} dealer base price must be >= 0.`
          );
        }
        if (Number(variant.defaultDealerPrice) > Number(variant.price)) {
          throw this.buildVariantValidationError(
            `${variantLabel} dealer base price cannot exceed retail price.`
          );
        }
      }
      if (variant.stock < 0) {
        throw this.buildVariantValidationError(
          `${variantLabel} must have non-negative stock.`
        );
      }
      if (variant.lowStockThreshold && variant.lowStockThreshold < 0) {
        throw this.buildVariantValidationError(
          `${variantLabel} must have non-negative low stock threshold.`
        );
      }
    });

    // Validate category and required attributes
    let requiredAttributeIds: string[] = [];
    let requiredAttributeNameById = new Map<string, string>();
    if (normalizedProductData.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: normalizedProductData.categoryId },
        include: {
          attributes: {
            where: { isRequired: true },
            select: { attributeId: true, attribute: { select: { name: true } } },
          },
        },
      });
      if (!category) {
        throw new AppError(404, "Category not found");
      }
      requiredAttributeIds = category.attributes.map((attr) => attr.attributeId);
      requiredAttributeNameById = new Map(
        category.attributes.map((attr) => [attr.attributeId, attr.attribute.name])
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
        select: { id: true, name: true },
      }),
      prisma.attributeValue.findMany({
        where: { id: { in: allValueIds } },
        select: { id: true, attributeId: true, value: true },
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
      const variantLabel = this.toVariantLabel(index);
      const attributeIds = variant.attributes.map((attr) => attr.attributeId);
      if (new Set(attributeIds).size !== attributeIds.length) {
        throw this.buildVariantValidationError(
          `${variantLabel} contains duplicate attributes. Each attribute can be selected only once.`
        );
      }

      variant.attributes.forEach((attr, attrIndex) => {
        const value = existingValues.find((v) => v.id === attr.valueId);
        if (!value || value.attributeId !== attr.attributeId) {
          throw this.buildVariantValidationError(
            `${variantLabel} has an invalid attribute mapping at attribute #${
              attrIndex + 1
            }.`
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
    const attributeNameById = new Map(
      existingAttributes.map((attribute) => [attribute.id, attribute.name])
    );
    const valueLabelById = new Map(
      existingValues.map((value) => [value.id, value.value])
    );
    const duplicateCombinationMessage = this.findDuplicateCombinationMessage(
      variants,
      attributeNameById,
      valueLabelById
    );
    if (duplicateCombinationMessage) {
      throw this.buildVariantValidationError(duplicateCombinationMessage);
    }

    // Validate required attributes
    variants.forEach((variant, index) => {
      const variantLabel = this.toVariantLabel(index);
      const variantAttributeIds = variant.attributes.map(
        (attr) => attr.attributeId
      );
      const missingAttributes = requiredAttributeIds.filter(
        (id) => !variantAttributeIds.includes(id)
      );
      if (missingAttributes.length > 0) {
        // Use requiredAttributeNameById (sourced from the category join) so we always
        // get human-readable names — even for attributes absent from all variants.
        const missingNames = missingAttributes.map(
          (id) => requiredAttributeNameById.get(id) ?? attributeNameById.get(id) ?? id
        );
        throw this.buildVariantValidationError(
          `${variantLabel} is missing required attributes: ${missingNames.join(", ")}.`
        );
      }
    });

    // Create product and variants in a transaction
    const createdProduct = await prisma.$transaction(async (tx) => {
      const product = await this.productRepository.createProduct({
        ...normalizedProductData,
        slug: slugify(normalizedProductData.name),
      }, tx);

      for (const variant of variants) {
        await this.variantRepository.createVariant({
          productId: product.id,
          sku: variant.sku,
          price: variant.price,
          defaultDealerPrice: variant.defaultDealerPrice ?? null,
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

    await clearCatalogListingCache();
    return createdProduct;
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
        defaultDealerPrice?: number | null;
        images: string[];
        stock: number;
        lowStockThreshold?: number;
        barcode?: string;
        attributes: { attributeId: string; valueId: string }[];
      }[];
    }>
  ): Promise<{ product: any; didChange: boolean }> {
    const existingProduct = await this.productRepository.findProductById(
      productId
    );
    if (!existingProduct) {
      throw new AppError(404, "Product not found");
    }

    const { variants, ...productData } = updatedData;
    const normalizedProductData = {
      ...productData,
      ...(typeof productData.name === "string"
        ? { name: normalizeHumanTextForField(productData.name, "name") }
        : {}),
    };

    // Validate variants if provided
    if (variants) {
      if (variants.length === 0) {
        if (existingProduct.variants.length === 1) {
          throw this.buildVariantValidationError(
            ProductService.BASE_VARIANT_DELETE_MESSAGE
          );
        }
        throw new AppError(400, "At least one variant is required");
      }

      const skuRegex = /^[a-zA-Z0-9-]+$/;
      const existingVariantById = new Map(
        existingProduct.variants.map((row) => [row.id, row])
      );
      const existingVariantBySku = new Map(
        existingProduct.variants.map((row) => [row.sku, row])
      );
      variants.forEach((variant, index) => {
        const variantLabel = this.toVariantLabel(index);
        if (
          !variant.sku ||
          !skuRegex.test(variant.sku) ||
          variant.sku.length < 3 ||
          variant.sku.length > 50
        ) {
          throw this.buildVariantValidationError(
            `${variantLabel} has an invalid SKU. Use alphanumeric characters and dashes, 3-50 characters.`
          );
        }
        if (variant.price <= 0) {
          throw this.buildVariantValidationError(
            `${variantLabel} must have a positive price.`
          );
        }
        const existingVariant =
          (variant.id && existingVariantById.get(variant.id)) ||
          existingVariantBySku.get(variant.sku);
        const effectiveDealerBasePrice =
          variant.defaultDealerPrice !== undefined
            ? variant.defaultDealerPrice
            : existingVariant?.defaultDealerPrice;
        if (
          effectiveDealerBasePrice !== undefined &&
          effectiveDealerBasePrice !== null
        ) {
          if (Number.isNaN(Number(effectiveDealerBasePrice))) {
            throw this.buildVariantValidationError(
              `${variantLabel} dealer base price must be numeric.`
            );
          }
          if (Number(effectiveDealerBasePrice) < 0) {
            throw this.buildVariantValidationError(
              `${variantLabel} dealer base price must be >= 0.`
            );
          }
          if (Number(effectiveDealerBasePrice) > Number(variant.price)) {
            throw this.buildVariantValidationError(
              `${variantLabel} dealer base price cannot exceed retail price.`
            );
          }
        }
        if (variant.stock < 0) {
          throw this.buildVariantValidationError(
            `${variantLabel} must have non-negative stock.`
          );
        }
        if (variant.lowStockThreshold && variant.lowStockThreshold < 0) {
          throw this.buildVariantValidationError(
            `${variantLabel} must have a non-negative low stock threshold.`
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
        select: { id: true, name: true },
      });
      if (existingAttributes.length !== allAttributeIds.length) {
        throw this.buildVariantValidationError("One or more attributes are invalid.");
      }

      const allValueIds = [
        ...new Set(variants.flatMap((v) => v.attributes.map((a) => a.valueId))),
      ];
      const existingValues = await prisma.attributeValue.findMany({
        where: { id: { in: allValueIds } },
        select: { id: true, attributeId: true, value: true },
      });
      if (existingValues.length !== allValueIds.length) {
        throw this.buildVariantValidationError(
          "One or more attribute values are invalid."
        );
      }

      variants.forEach((variant, index) => {
        const variantLabel = this.toVariantLabel(index);
        const attributeIds = variant.attributes.map((attr) => attr.attributeId);
        if (new Set(attributeIds).size !== attributeIds.length) {
          throw this.buildVariantValidationError(
            `${variantLabel} contains duplicate attributes. Each attribute can be selected only once.`
          );
        }

        variant.attributes.forEach((attr, attrIndex) => {
          const value = existingValues.find((row) => row.id === attr.valueId);
          if (!value || value.attributeId !== attr.attributeId) {
            throw this.buildVariantValidationError(
              `${variantLabel} has an invalid attribute mapping at attribute #${
                attrIndex + 1
              }.`
            );
          }
        });
      });

      const attributeNameById = new Map(
        existingAttributes.map((attribute) => [attribute.id, attribute.name])
      );
      const valueLabelById = new Map(
        existingValues.map((value) => [value.id, value.value])
      );
      const duplicateCombinationMessage = this.findDuplicateCombinationMessage(
        variants,
        attributeNameById,
        valueLabelById
      );
      if (duplicateCombinationMessage) {
        throw this.buildVariantValidationError(duplicateCombinationMessage);
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

      const categoryId =
        normalizedProductData.categoryId || existingProduct.categoryId;
      let requiredAttributeIds: string[] = [];
      let requiredAttributeNameById = new Map<string, string>();
      if (categoryId) {
        const requiredAttributes = await prisma.categoryAttribute.findMany({
          where: { categoryId, isRequired: true },
          select: { attributeId: true, attribute: { select: { name: true } } },
        });
        requiredAttributeIds = requiredAttributes.map((attr) => attr.attributeId);
        requiredAttributeNameById = new Map(
          requiredAttributes.map((attr) => [attr.attributeId, attr.attribute.name])
        );
      }

      variants.forEach((variant, index) => {
        const variantLabel = this.toVariantLabel(index);
        const variantAttributeIds = variant.attributes.map(
          (attr) => attr.attributeId
        );
        const missingAttributes = requiredAttributeIds.filter(
          (id) => !variantAttributeIds.includes(id)
        );
        if (missingAttributes.length > 0) {
          const missingNames = missingAttributes.map(
            (id) => requiredAttributeNameById.get(id) ?? id
          );
          throw this.buildVariantValidationError(
            `${variantLabel} is missing required attributes: ${missingNames.join(", ")}.`
          );
        }
      });
    }

    const hasProductChanges = this.hasProductFieldChanges(
      existingProduct,
      normalizedProductData
    );
    const hasVariantChanges =
      Array.isArray(variants) &&
      this.hasVariantCollectionChanges(existingProduct.variants as any, variants);

    if (!hasProductChanges && !hasVariantChanges) {
      return {
        product: existingProduct,
        didChange: false,
      };
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      await this.productRepository.updateProduct(
        productId,
        {
          ...normalizedProductData,
          ...(normalizedProductData.name && {
            slug: slugify(normalizedProductData.name),
          }),
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

            // Build update data explicitly to avoid dynamic object construction
            const updateData: {
              sku: string;
              price: number;
              defaultDealerPrice?: number | null;
              stock: number;
              lowStockThreshold: number;
              barcode: string | null;
              images: string[];
            } = {
              sku: variant.sku,
              price: variant.price,
              stock: variant.stock,
              lowStockThreshold: variant.lowStockThreshold || 10,
              barcode: variant.barcode || null,
              images: variant.images || [],
            };

            // Only update defaultDealerPrice if explicitly provided in payload
            if ("defaultDealerPrice" in variant) {
              updateData.defaultDealerPrice = variant.defaultDealerPrice ?? null;
            }

            await tx.productVariant.update({
              where: { id: existingVariant.id },
              data: updateData,
            });

            await tx.productVariantAttribute.deleteMany({
              where: { variantId: existingVariant.id },
            });

            if (variant.attributes.length > 0) {
              // Build attribute data explicitly to avoid dynamic object construction
              const attributeData = variant.attributes.map((attribute) => {
                return {
                  variantId: existingVariant.id,
                  attributeId: attribute.attributeId,
                  valueId: attribute.valueId,
                };
              });
              
              await tx.productVariantAttribute.createMany({
                data: attributeData,
              });
            }

            continue;
          }

          const createdVariant = await this.variantRepository.createVariant(
            {
              productId,
              sku: variant.sku,
              price: variant.price,
              defaultDealerPrice: variant.defaultDealerPrice ?? null,
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
          if (existingVariants.length === 1) {
            throw this.buildVariantValidationError(
              ProductService.BASE_VARIANT_DELETE_MESSAGE
            );
          }

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

    await clearCatalogListingCache();

    return {
      product: updatedProduct,
      didChange: true,
    };
  }

  async bulkCreateProducts(file: Express.Multer.File) {
    const result = await this.bulkImporter.run(file);
    if (result.count > 0) {
      await clearCatalogListingCache();
    }
    return result;
  }

  async deleteProduct(productId: string) {
    const product = await this.productRepository.findProductById(productId);
    if (!product) {
      throw new AppError(404, "Product not found");
    }

    await this.productRepository.deleteProduct(productId);
    await clearCatalogListingCache();
  }
}
