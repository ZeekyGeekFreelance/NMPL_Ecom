/**
 * VariantValidationService
 * ──────────────────────────────────────────────────────────────────────────
 * All variant/attribute validation logic extracted from ProductService.
 * Handles: SKU format, price guards, attribute-value pair validity,
 * required attribute enforcement, and duplicate combination detection.
 */
import AppError from "@/shared/errors/AppError";
import prisma from "@/infra/database/database.config";

export type VariantInput = {
  id?: string;
  sku: string;
  price: number;
  defaultDealerPrice?: number | null;
  images: string[];
  stock: number;
  lowStockThreshold?: number;
  barcode?: string;
  attributes: { attributeId: string; valueId: string }[];
};

export class VariantValidationService {
  buildVariantValidationError(message: string): AppError {
    return new AppError(400, message, true, [
      { property: "variants", constraints: { integrity: message } },
    ]);
  }

  toVariantLabel(index: number): string {
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
    return attributes
      .map((attr) => {
        const attributeName = attributeNameById.get(attr.attributeId) || "Attribute";
        const valueLabel = valueLabelById.get(attr.valueId) || "Value";
        return `${attributeName} = ${valueLabel}`;
      })
      .sort((a, b) => a.localeCompare(b))
      .join(", ");
  }

  findDuplicateCombinationMessage(
    variants: Array<{ attributes: Array<{ attributeId: string; valueId: string }> }>,
    attributeNameById: Map<string, string>,
    valueLabelById: Map<string, string>
  ): string | null {
    const seenByKey = new Map<string, number>();
    for (let i = 0; i < variants.length; i++) {
      const key = this.buildCombinationKey(variants[i].attributes);
      const existing = seenByKey.get(key);
      if (existing !== undefined) {
        const readable = this.describeAttributeCombination(
          variants[i].attributes,
          attributeNameById,
          valueLabelById
        );
        return readable
          ? `Duplicate attribute combination: ${readable} already exists.`
          : `${this.toVariantLabel(i)} has the same attribute combination as ${this.toVariantLabel(existing)}.`;
      }
      seenByKey.set(key, i);
    }
    return null;
  }

  /**
   * Validate scalar fields on each variant (SKU format, price, stock, dealer price).
   * Does not touch the DB — pure sync validation.
   */
  validateVariantScalars(variants: VariantInput[], existingById?: Map<string, any>): void {
    const skuRegex = /^[a-zA-Z0-9-]+$/;
    variants.forEach((variant, index) => {
      const label = this.toVariantLabel(index);

      if (!variant.sku || !skuRegex.test(variant.sku) || variant.sku.length < 3 || variant.sku.length > 50) {
        throw this.buildVariantValidationError(
          `${label} has an invalid SKU. Use alphanumeric characters and dashes, 3-50 characters.`
        );
      }
      if (variant.price <= 0) {
        throw this.buildVariantValidationError(`${label} must have a positive price.`);
      }

      // Resolve the effective dealer base price (incoming, or from DB if unchanged)
      const existingVariant = existingById
        ? (variant.id && existingById.get(variant.id)) || undefined
        : undefined;
      const effectiveDealerBasePrice =
        variant.defaultDealerPrice !== undefined
          ? variant.defaultDealerPrice
          : existingVariant?.defaultDealerPrice;

      if (effectiveDealerBasePrice !== undefined && effectiveDealerBasePrice !== null) {
        if (Number.isNaN(Number(effectiveDealerBasePrice))) {
          throw this.buildVariantValidationError(`${label} dealer base price must be numeric.`);
        }
        if (Number(effectiveDealerBasePrice) < 0) {
          throw this.buildVariantValidationError(`${label} dealer base price must be >= 0.`);
        }
        if (Number(effectiveDealerBasePrice) > Number(variant.price)) {
          throw this.buildVariantValidationError(
            `${label} dealer base price cannot exceed retail price.`
          );
        }
      }
      if (variant.stock < 0) {
        throw this.buildVariantValidationError(`${label} must have non-negative stock.`);
      }
      if (variant.lowStockThreshold && variant.lowStockThreshold < 0) {
        throw this.buildVariantValidationError(
          `${label} must have non-negative low stock threshold.`
        );
      }
    });
  }

  /**
   * Validate that all attributeIds and valueIds exist, and that each value
   * belongs to its claimed attribute. Returns the loaded lookup maps.
   */
  async validateAttributesExist(variants: VariantInput[]): Promise<{
    attributeNameById: Map<string, string>;
    valueLabelById: Map<string, string>;
    existingValues: Array<{ id: string; attributeId: string; value: string }>;
  }> {
    const allAttributeIds = [...new Set(variants.flatMap((v) => v.attributes.map((a) => a.attributeId)))];
    const allValueIds = [...new Set(variants.flatMap((v) => v.attributes.map((a) => a.valueId)))];

    const [existingAttributes, existingValues] = await Promise.all([
      prisma.attribute.findMany({ where: { id: { in: allAttributeIds } }, select: { id: true, name: true } }),
      prisma.attributeValue.findMany({ where: { id: { in: allValueIds } }, select: { id: true, attributeId: true, value: true } }),
    ]);

    if (existingAttributes.length !== allAttributeIds.length) {
      throw new AppError(400, "One or more attribute IDs are invalid");
    }
    if (existingValues.length !== allValueIds.length) {
      throw new AppError(400, "One or more attribute value IDs are invalid");
    }

    variants.forEach((variant, index) => {
      const label = this.toVariantLabel(index);
      const attrIds = variant.attributes.map((a) => a.attributeId);
      if (new Set(attrIds).size !== attrIds.length) {
        throw this.buildVariantValidationError(
          `${label} contains duplicate attributes. Each attribute can be selected only once.`
        );
      }
      variant.attributes.forEach((attr, attrIndex) => {
        const value = existingValues.find((v) => v.id === attr.valueId);
        if (!value || value.attributeId !== attr.attributeId) {
          throw this.buildVariantValidationError(
            `${label} has an invalid attribute mapping at attribute #${attrIndex + 1}.`
          );
        }
      });
    });

    const attributeNameById = new Map(existingAttributes.map((a) => [a.id, a.name]));
    const valueLabelById = new Map(existingValues.map((v) => [v.id, v.value]));
    return { attributeNameById, valueLabelById, existingValues };
  }

  /**
   * Check for duplicate attribute combinations across variants.
   */
  assertNoDuplicateCombinations(
    variants: VariantInput[],
    attributeNameById: Map<string, string>,
    valueLabelById: Map<string, string>
  ): void {
    const msg = this.findDuplicateCombinationMessage(variants, attributeNameById, valueLabelById);
    if (msg) throw this.buildVariantValidationError(msg);
  }

  /**
   * Enforce required category attributes across all variants.
   */
  validateRequiredAttributes(
    variants: VariantInput[],
    requiredAttributeIds: string[],
    requiredAttributeNameById: Map<string, string>,
    attributeNameById: Map<string, string>
  ): void {
    variants.forEach((variant, index) => {
      const label = this.toVariantLabel(index);
      const variantAttrIds = variant.attributes.map((a) => a.attributeId);
      const missing = requiredAttributeIds.filter((id) => !variantAttrIds.includes(id));
      if (missing.length > 0) {
        const names = missing.map((id) => requiredAttributeNameById.get(id) ?? attributeNameById.get(id) ?? id);
        throw this.buildVariantValidationError(
          `${label} is missing required attributes: ${names.join(", ")}.`
        );
      }
    });
  }
}
