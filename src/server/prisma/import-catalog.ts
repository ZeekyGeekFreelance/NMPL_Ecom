import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXPECTED_CATALOG_PRODUCTS = 1213;
const LOCAL_DB_PATTERN = /(localhost|127\.0\.0\.1|::1)/i;
const NON_PROD_TOKEN_PATTERN = /\b(dev|test|staging|sandbox)\b/i;

type CatalogAttributeInput = {
  attributeName: string;
  attributeSlug: string;
  value: string;
  valueSlug: string;
  requiredInCategory?: boolean;
};

type CatalogVariantInput = {
  sku: string;
  price: number;
  stock: number;
  lowStockThreshold?: number;
  barcode?: string | null;
  images?: string[];
  attributes?: CatalogAttributeInput[];
};

type CatalogProductInput = {
  name: string;
  slug: string;
  description?: string | null;
  isNew?: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  isBestSeller?: boolean;
  category: {
    name: string;
    slug: string;
    description?: string | null;
    images?: string[];
  };
  variants: CatalogVariantInput[];
};

type CatalogDocument = {
  source: string;
  version: string;
  products: CatalogProductInput[];
};

const parseDbHost = (databaseUrl: string): string => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "invalid-url";
  }
};

const assertProductionCatalogGuards = (): void => {
  const nodeEnv = (process.env.NODE_ENV || "").trim().toLowerCase();
  const dbEnv = (process.env.DB_ENV || "").trim().toLowerCase();
  const databaseUrl = (process.env.DATABASE_URL || "").trim();

  if (!databaseUrl) {
    throw new Error("[import-catalog] DATABASE_URL is required.");
  }

  const dbHost = parseDbHost(databaseUrl);

  console.warn(
    `[import-catalog] Guard check | NODE_ENV=${nodeEnv || "unset"} DB_ENV=${dbEnv || "unset"} DB_HOST=${dbHost}`
  );

  if (nodeEnv !== "production") {
    throw new Error(
      "[import-catalog] Blocked: importCatalog is allowed only when NODE_ENV=production."
    );
  }

  if (dbEnv !== "production") {
    throw new Error(
      "[import-catalog] Blocked: DB_ENV must be set to production for production catalog import."
    );
  }

  if (process.env.ALLOW_PROD_CATALOG_IMPORT !== "true") {
    throw new Error(
      "[import-catalog] Blocked: set ALLOW_PROD_CATALOG_IMPORT=true for explicit authorization."
    );
  }

  if (LOCAL_DB_PATTERN.test(dbHost)) {
    throw new Error("[import-catalog] Blocked: local database host is not allowed.");
  }

  if (NON_PROD_TOKEN_PATTERN.test(databaseUrl)) {
    throw new Error(
      "[import-catalog] Blocked: DATABASE_URL appears non-production (contains dev/test/staging/sandbox)."
    );
  }
};

const catalogFilePath = path.resolve(__dirname, "catalog", "sewing-products.json");

const loadCatalog = (): CatalogDocument => {
  if (!fs.existsSync(catalogFilePath)) {
    throw new Error(
      `[import-catalog] Catalog file not found: ${catalogFilePath}. Place the full 1213-product sewing catalog JSON file here.`
    );
  }

  const raw = fs.readFileSync(catalogFilePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<CatalogDocument>;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("[import-catalog] Catalog payload is invalid JSON object.");
  }

  if (!Array.isArray(parsed.products)) {
    throw new Error("[import-catalog] Catalog payload must contain products array.");
  }

  if (parsed.products.length !== EXPECTED_CATALOG_PRODUCTS) {
    throw new Error(
      `[import-catalog] Expected ${EXPECTED_CATALOG_PRODUCTS} products, received ${parsed.products.length}. Refusing partial import.`
    );
  }

  return {
    source: String(parsed.source || "unknown"),
    version: String(parsed.version || "unknown"),
    products: parsed.products as CatalogProductInput[],
  };
};

const assertUniqueCatalogKeys = (catalog: CatalogDocument): void => {
  const productSlugSet = new Set<string>();
  const variantSkuSet = new Set<string>();

  for (const product of catalog.products) {
    const normalizedSlug = product.slug.trim().toLowerCase();
    if (!normalizedSlug) {
      throw new Error("[import-catalog] Product slug cannot be empty.");
    }
    if (productSlugSet.has(normalizedSlug)) {
      throw new Error(`[import-catalog] Duplicate product slug detected: ${product.slug}`);
    }
    productSlugSet.add(normalizedSlug);

    for (const variant of product.variants || []) {
      const normalizedSku = variant.sku.trim().toLowerCase();
      if (!normalizedSku) {
        throw new Error(
          `[import-catalog] Empty SKU found in product '${product.slug}'.`
        );
      }
      if (variantSkuSet.has(normalizedSku)) {
        throw new Error(`[import-catalog] Duplicate SKU detected: ${variant.sku}`);
      }
      variantSkuSet.add(normalizedSku);
    }
  }
};

export const importCatalog = async (): Promise<void> => {
  assertProductionCatalogGuards();

  const catalog = loadCatalog();
  assertUniqueCatalogKeys(catalog);

  console.warn(
    `[import-catalog] Starting idempotent import | source=${catalog.source} version=${catalog.version} products=${catalog.products.length}`
  );

  for (const productInput of catalog.products) {
    const category = await prisma.category.upsert({
      where: { slug: productInput.category.slug },
      update: {
        name: productInput.category.name,
        description: productInput.category.description || null,
        images: productInput.category.images || [],
      },
      create: {
        slug: productInput.category.slug,
        name: productInput.category.name,
        description: productInput.category.description || null,
        images: productInput.category.images || [],
      },
    });

    const product = await prisma.product.upsert({
      where: { slug: productInput.slug },
      update: {
        name: productInput.name,
        description: productInput.description || null,
        categoryId: category.id,
        isNew: Boolean(productInput.isNew),
        isFeatured: Boolean(productInput.isFeatured),
        isTrending: Boolean(productInput.isTrending),
        isBestSeller: Boolean(productInput.isBestSeller),
      },
      create: {
        slug: productInput.slug,
        name: productInput.name,
        description: productInput.description || null,
        categoryId: category.id,
        isNew: Boolean(productInput.isNew),
        isFeatured: Boolean(productInput.isFeatured),
        isTrending: Boolean(productInput.isTrending),
        isBestSeller: Boolean(productInput.isBestSeller),
      },
    });

    for (const variantInput of productInput.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: variantInput.sku },
        update: {
          productId: product.id,
          price: Number(variantInput.price),
          stock: Number(variantInput.stock),
          lowStockThreshold: Number(variantInput.lowStockThreshold ?? 10),
          barcode: variantInput.barcode || null,
          images: variantInput.images || [],
        },
        create: {
          productId: product.id,
          sku: variantInput.sku,
          price: Number(variantInput.price),
          stock: Number(variantInput.stock),
          lowStockThreshold: Number(variantInput.lowStockThreshold ?? 10),
          barcode: variantInput.barcode || null,
          images: variantInput.images || [],
        },
      });

      for (const attrInput of variantInput.attributes || []) {
        const attribute = await prisma.attribute.upsert({
          where: { slug: attrInput.attributeSlug },
          update: {
            name: attrInput.attributeName,
          },
          create: {
            slug: attrInput.attributeSlug,
            name: attrInput.attributeName,
          },
        });

        const attributeValue = await prisma.attributeValue.upsert({
          where: { slug: attrInput.valueSlug },
          update: {
            attributeId: attribute.id,
            value: attrInput.value,
          },
          create: {
            slug: attrInput.valueSlug,
            attributeId: attribute.id,
            value: attrInput.value,
          },
        });

        await prisma.categoryAttribute.upsert({
          where: {
            categoryId_attributeId: {
              categoryId: category.id,
              attributeId: attribute.id,
            },
          },
          update: {
            isRequired: Boolean(attrInput.requiredInCategory),
          },
          create: {
            categoryId: category.id,
            attributeId: attribute.id,
            isRequired: Boolean(attrInput.requiredInCategory),
          },
        });

        await prisma.productVariantAttribute.upsert({
          where: {
            variantId_attributeId_valueId: {
              variantId: variant.id,
              attributeId: attribute.id,
              valueId: attributeValue.id,
            },
          },
          update: {},
          create: {
            variantId: variant.id,
            attributeId: attribute.id,
            valueId: attributeValue.id,
          },
        });
      }
    }
  }

  console.log(
    `[import-catalog] Completed successfully with ${catalog.products.length} products.`
  );
};

if (require.main === module) {
  importCatalog()
    .catch((error) => {
      console.error("[import-catalog] Failed:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
