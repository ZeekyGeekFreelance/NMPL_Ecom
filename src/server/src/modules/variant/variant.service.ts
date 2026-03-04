import AppError from "@/shared/errors/AppError";
import { VariantRepository } from "./variant.repository";
import { AttributeRepository } from "../attribute/attribute.repository";
import prisma from "@/infra/database/database.config";
import ApiFeatures from "@/shared/utils/ApiFeatures";
import { clearCatalogListingCache } from "@/modules/product/graphql/resolver";

export class VariantService {
  private static readonly BASE_VARIANT_DELETE_MESSAGE =
    "Base variant cannot be deleted. Add another variant first or delete the product instead.";

  constructor(
    private variantRepository: VariantRepository,
    private attributeRepository: AttributeRepository
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

  private describeAttributeCombination(
    attributes: Array<{ attributeId: string; valueId: string }>,
    attributeNameById: Map<string, string>,
    valueLabelById: Map<string, string>
  ): string {
    return attributes
      .map((attribute) => {
        const attributeName = attributeNameById.get(attribute.attributeId) || "Attribute";
        const valueLabel = valueLabelById.get(attribute.valueId) || "Value";
        return `${attributeName} = ${valueLabel}`;
      })
      .sort((a, b) => a.localeCompare(b))
      .join(", ");
  }

  async getAllVariants(queryString: Record<string, any>) {
    const apiFeatures = new ApiFeatures(queryString)
      .filter()
      .sort()
      .limitFields()
      .paginate()
      .build();

    const { where, orderBy, skip, take, select } = apiFeatures;

    const finalWhere = where && Object.keys(where).length > 0 ? where : {};

    const totalResults = await this.variantRepository.countVariants({
      where: finalWhere,
    });

    const totalPages = Math.ceil(totalResults / take);
    const currentPage = Math.floor(skip / take) + 1;

    const variants = await this.variantRepository.findManyVariants({
      where: finalWhere,
      orderBy: orderBy || { createdAt: "desc" },
      skip,
      take,
      select,
    });

    return {
      variants,
      totalResults,
      totalPages,
      currentPage,
      resultsPerPage: take,
    };
  }

  async getRestockHistory(
    variantId: string,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;
    const take = limit;

    const totalResults = await this.variantRepository.countRestocks({
      variantId,
    });
    const totalPages = Math.ceil(totalResults / take);
    const currentPage = page;

    const restocks = await this.variantRepository.findRestockHistory({
      variantId,
      skip,
      take,
    });

    return {
      restocks,
      totalResults,
      totalPages,
      currentPage,
      resultsPerPage: take,
    };
  }

  async getVariantById(variantId: string) {
    const variant = await this.variantRepository.findVariantById(variantId);
    if (!variant) {
      throw new AppError(404, "Variant not found");
    }
    return variant;
  }

  async getVariantBySku(sku: string) {
    const variant = await this.variantRepository.findVariantBySku(sku);
    if (!variant) {
      throw new AppError(404, "Variant not found");
    }
    return variant;
  }

  async createVariant(data: {
    productId: string;
    sku: string;
    price: number;
    defaultDealerPrice?: number | null;
    images: string[];
    stock: number;
    lowStockThreshold?: number;
    barcode?: string;
    attributes: { attributeId: string; valueId: string }[];
  }) {
    const { productId, attributes } = data;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new AppError(404, "Product not found");
    }

    const existingVariant = await prisma.productVariant.findUnique({
      where: { sku: data.sku },
    });
    if (existingVariant) {
      throw new AppError(400, "SKU already exists");
    }

    if (!attributes || attributes.length === 0) {
      throw new AppError(400, "At least one attribute is required");
    }

    if (product.categoryId) {
      const requiredAttributes = await prisma.categoryAttribute.findMany({
        where: { categoryId: product.categoryId, isRequired: true },
        select: { attributeId: true },
      });
      const requiredAttributeIds = requiredAttributes.map(
        (attr) => attr.attributeId
      );
      const variantAttributeIds = attributes.map((attr) => attr.attributeId);
      const missingAttributes = requiredAttributeIds.filter(
        (id) => !variantAttributeIds.includes(id)
      );
      if (missingAttributes.length > 0) {
        throw new AppError(
          400,
          `Variant is missing required attributes: ${missingAttributes.join(
            ", "
          )}`
        );
      }
    }

    const allAttributeIds = [...new Set(attributes.map((a) => a.attributeId))];
    const existingAttributes = await prisma.attribute.findMany({
      where: { id: { in: allAttributeIds } },
    });
    if (existingAttributes.length !== allAttributeIds.length) {
      throw new AppError(400, "One or more attributes are invalid");
    }

    const allValueIds = [...new Set(attributes.map((a) => a.valueId))];
    const existingValues = await prisma.attributeValue.findMany({
      where: { id: { in: allValueIds } },
      select: { id: true, attributeId: true, value: true },
    });
    if (existingValues.length !== allValueIds.length) {
      throw new AppError(400, "One or more attribute values are invalid");
    }

    if (new Set(allAttributeIds).size !== allAttributeIds.length) {
      throw new AppError(400, "Duplicate attributes in variant");
    }

    const existingVariants = await prisma.productVariant.findMany({
      where: { productId },
      include: { attributes: true },
    });

    const newComboKey = attributes
      .map((a) => `${a.attributeId}:${a.valueId}`)
      .sort()
      .join("|");
    const isDuplicateCombo = existingVariants.some(
      (v) =>
        v.attributes
          .map((a) => `${a.attributeId}:${a.valueId}`)
          .sort()
          .join("|") === newComboKey
    );
    if (isDuplicateCombo) {
      const attributeNameById = new Map(
        existingAttributes.map((attribute) => [attribute.id, attribute.name])
      );
      const valueLabelById = new Map(
        existingValues.map((value) => [value.id, value.value])
      );
      const readableCombination = this.describeAttributeCombination(
        attributes,
        attributeNameById,
        valueLabelById
      );
      throw this.buildVariantValidationError(
        readableCombination
          ? `Duplicate attribute combination: ${readableCombination} already exists.`
          : "Variant with same attribute combination already defined."
      );
    }

    const createdVariant = await this.variantRepository.createVariant(data);
    clearCatalogListingCache();
    return createdVariant;
  }

  async updateVariant(
    variantId: string,
    data: Partial<{
      sku: string;
      price: number;
      defaultDealerPrice?: number | null;
      images?: string[];
      stock: number;
      lowStockThreshold?: number;
      barcode?: string;
      attributes: { attributeId: string; valueId: string }[];
    }>
  ) {
    const existingVariant = await this.variantRepository.findVariantById(
      variantId
    );
    if (!existingVariant) {
      throw new AppError(404, "Variant not found");
    }

    if (data.sku && data.sku !== existingVariant.sku) {
      const existingSku = await prisma.productVariant.findUnique({
        where: { sku: data.sku },
      });
      if (existingSku) {
        throw new AppError(400, "SKU already exists");
      }
    }

    if (data.attributes) {
      if (data.attributes.length === 0) {
        throw new AppError(400, "At least one attribute is required");
      }

      const product = await prisma.product.findUnique({
        where: { id: existingVariant.productId },
      });
      if (product?.categoryId) {
        const requiredAttributes = await prisma.categoryAttribute.findMany({
          where: { categoryId: product.categoryId, isRequired: true },
          select: { attributeId: true },
        });
        const requiredAttributeIds = requiredAttributes.map(
          (attr) => attr.attributeId
        );
        const variantAttributeIds = data.attributes.map(
          (attr) => attr.attributeId
        );
        const missingAttributes = requiredAttributeIds.filter(
          (id) => !variantAttributeIds.includes(id)
        );
        if (missingAttributes.length > 0) {
          throw new AppError(
            400,
            `Variant is missing required attributes: ${missingAttributes.join(
              ", "
            )}`
          );
        }
      }

      const allAttributeIds = [
        ...new Set(data.attributes.map((a) => a.attributeId)),
      ];
      const existingAttributes = await prisma.attribute.findMany({
        where: { id: { in: allAttributeIds } },
      });
      if (existingAttributes.length !== allAttributeIds.length) {
        throw new AppError(400, "One or more attributes are invalid");
      }

      const allValueIds = [...new Set(data.attributes.map((a) => a.valueId))];
      const existingValues = await prisma.attributeValue.findMany({
        where: { id: { in: allValueIds } },
        select: { id: true, attributeId: true, value: true },
      });
      if (existingValues.length !== allValueIds.length) {
        throw new AppError(400, "One or more attribute values are invalid");
      }

      if (new Set(allAttributeIds).size !== allAttributeIds.length) {
        throw new AppError(400, "Duplicate attributes in variant");
      }

      const existingVariants = await prisma.productVariant.findMany({
        where: { productId: existingVariant.productId, id: { not: variantId } },
        include: { attributes: true },
      });
      const newComboKey = data.attributes
        .map((a) => `${a.attributeId}:${a.valueId}`)
        .sort()
        .join("|");
      const isDuplicateCombo = existingVariants.some(
        (v) =>
          v.attributes
            .map((a) => `${a.attributeId}:${a.valueId}`)
            .sort()
            .join("|") === newComboKey
      );
      if (isDuplicateCombo) {
        const attributeNameById = new Map(
          existingAttributes.map((attribute) => [attribute.id, attribute.name])
        );
        const valueLabelById = new Map(
          existingValues.map((value) => [value.id, value.value])
        );
        const readableCombination = this.describeAttributeCombination(
          data.attributes,
          attributeNameById,
          valueLabelById
        );
        throw this.buildVariantValidationError(
          readableCombination
            ? `Duplicate attribute combination: ${readableCombination} already exists.`
            : "Variant with same attribute combination already defined."
        );
      }
    }

    const updatedVariant = await this.variantRepository.updateVariant(variantId, data);
    clearCatalogListingCache();
    return updatedVariant;
  }

  async restockVariant(
    variantId: string,
    quantity: number,
    notes?: string,
    userId?: string
  ) {
    if (quantity <= 0) {
      throw new AppError(400, "Quantity must be positive");
    }

    const existingVariant = await this.variantRepository.findVariantById(
      variantId
    );
    if (!existingVariant) {
      throw new AppError(404, "Variant not found");
    }

    const restockResult = await prisma.$transaction(async (tx) => {
      const restock = await this.variantRepository.createRestock({
        variantId,
        quantity,
        notes,
        userId,
      });

      await this.variantRepository.updateVariantStock(variantId, quantity);

      await this.variantRepository.createStockMovement({
        variantId,
        quantity,
        reason: "restock",
        userId,
      });

      const updatedVariant = await this.variantRepository.findVariantById(
        variantId
      );
      const isLowStock =
        updatedVariant?.stock && updatedVariant.lowStockThreshold
          ? updatedVariant.stock <= updatedVariant.lowStockThreshold
          : false;

      return { restock, isLowStock };
    });

    clearCatalogListingCache();
    return restockResult;
  }

  async deleteVariant(variantId: string) {
    const variant = await this.variantRepository.findVariantById(variantId);
    if (!variant) {
      throw new AppError(404, "Variant not found");
    }

    const productVariantCount = await prisma.productVariant.count({
      where: { productId: variant.productId },
    });

    if (productVariantCount <= 1) {
      throw this.buildVariantValidationError(
        VariantService.BASE_VARIANT_DELETE_MESSAGE
      );
    }

    await this.variantRepository.deleteVariant(variantId);
    clearCatalogListingCache();
  }
}
