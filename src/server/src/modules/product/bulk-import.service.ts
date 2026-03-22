/**
 * BulkImportService
 * ──────────────────────────────────────────────────────────────────────────
 * CSV bulk product import logic extracted from ProductService.
 * Handles file parsing, row validation (including SKU format), and the
 * batched Prisma transaction that creates products + variants.
 */
import AppError from "@/shared/errors/AppError";
import { parse } from "csv-parse/sync";
import prisma from "@/infra/database/database.config";
import { normalizeHumanTextForField } from "@/shared/utils/textNormalization";
import slugify from "@/shared/utils/slugify";

const SKU_REGEX = /^[a-zA-Z0-9-]+$/;

type ParsedRow = {
  name: string;
  slug: string;
  description: string | undefined;
  categoryId: string | undefined;
  isNew: boolean;
  isTrending: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  sku: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
};

export class BulkImportService {
  private parseBoolean(value: unknown): boolean {
    return (
      value === true ||
      value === "true" ||
      value === "TRUE" ||
      value === 1 ||
      value === "1"
    );
  }

  /**
   * Parse a CSV file buffer into raw record objects.
   */
  private parseFile(file: Express.Multer.File): unknown[] {
    if (file.mimetype === "text/csv") {
      return parse(file.buffer.toString(), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    }

    throw new AppError(400, "Unsupported file format. Use CSV");
  }

  /**
   * Validate a single raw record and return a typed ParsedRow.
   * Throws AppError with a descriptive message on the first invalid field.
   */
  private validateRow(record: any, rowIndex: number): ParsedRow {
    const humanIndex = rowIndex + 1;
    const name = record.name
      ? normalizeHumanTextForField(String(record.name), "name")
      : "";
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
        `Invalid record at row ${humanIndex}. Required columns: name, sku, price, stock.`
      );
    }

    if (!SKU_REGEX.test(sku) || sku.length < 3 || sku.length > 50) {
      throw new AppError(
        400,
        `Invalid SKU at row ${humanIndex}: "${sku}". Use alphanumeric characters and dashes only, 3–50 characters.`
      );
    }

    if (price <= 0) {
      throw new AppError(
        400,
        `Invalid price at row ${humanIndex}. Price must be greater than 0.`
      );
    }

    if (stock < 0) {
      throw new AppError(
        400,
        `Invalid stock at row ${humanIndex}. Stock must be non-negative.`
      );
    }

    if (Number.isNaN(lowStockThresholdRaw) || lowStockThresholdRaw < 0) {
      throw new AppError(400, `Invalid lowStockThreshold at row ${humanIndex}.`);
    }

    return {
      name,
      slug: slugify(name),
      description: record.description ? String(record.description) : undefined,
      categoryId: record.categoryId ? String(record.categoryId) : undefined,
      isNew: this.parseBoolean(record.isNew),
      isTrending: this.parseBoolean(record.isTrending),
      isBestSeller: this.parseBoolean(record.isBestSeller),
      isFeatured: this.parseBoolean(record.isFeatured),
      sku,
      price,
      stock,
      lowStockThreshold: lowStockThresholdRaw,
    };
  }

  /**
   * Validate that every categoryId referenced in the rows actually exists.
   */
  private async validateCategories(rows: ParsedRow[]): Promise<void> {
    const categoryIds = rows
      .filter((row) => row.categoryId)
      .map((row) => row.categoryId!);

    if (categoryIds.length === 0) return;

    const existing = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    const validIds = new Set(existing.map((c) => c.id));
    for (const row of rows) {
      if (row.categoryId && !validIds.has(row.categoryId)) {
        throw new AppError(400, `Invalid categoryId: ${row.categoryId}`);
      }
    }
  }

  /**
   * Execute the bulk import transaction and return counts.
   */
  private async importRows(
    rows: ParsedRow[]
  ): Promise<{ createdVariants: number; skippedVariants: number }> {
    return prisma.$transaction(async (tx) => {
      let createdVariants = 0;
      let skippedVariants = 0;
      const productIdCache = new Map<string, string>();

      for (const row of rows) {
        const existingVariant = await tx.productVariant.findUnique({
          where: { sku: row.sku },
          select: { id: true },
        });

        if (existingVariant) {
          skippedVariants++;
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
            const created = await tx.product.create({
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
            productId = created.id;
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

        createdVariants++;
      }

      return { createdVariants, skippedVariants };
    });
  }

  /**
   * Public entry point.  Parses, validates, and imports the file.
   */
  async run(
    file: Express.Multer.File
  ): Promise<{ count: number; skipped: number }> {
    if (!file) throw new AppError(400, "No file uploaded");

    let rawRecords: unknown[];
    try {
      rawRecords = this.parseFile(file);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(400, "Failed to parse file");
    }

    if (rawRecords.length === 0) throw new AppError(400, "File is empty");

    const rows = rawRecords.map((record, index) =>
      this.validateRow(record, index)
    );

    await this.validateCategories(rows);

    const result = await this.importRows(rows);

    return { count: result.createdVariants, skipped: result.skippedVariants };
  }
}
