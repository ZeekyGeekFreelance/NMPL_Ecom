import { PrismaClient, ROLE } from "@prisma/client";

const prisma = new PrismaClient();

const PROD_TOKEN_PATTERN = /\bproduction\b/i;
const LOCAL_DB_PATTERN = /(localhost|127\.0\.0\.1|::1)/i;

type SeedContext = {
  nodeEnv: string;
  dbEnv: string;
  databaseUrl: string;
  dbHost: string;
};

const parseDbHost = (databaseUrl: string): string => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "invalid-url";
  }
};

const readSeedContext = (): SeedContext => {
  const nodeEnv = (process.env.NODE_ENV || "development").trim().toLowerCase();
  const dbEnv = (process.env.DB_ENV || "").trim().toLowerCase();
  const databaseUrl = (process.env.DATABASE_URL || "").trim();

  if (!databaseUrl) {
    throw new Error("[seed-dev] DATABASE_URL is required.");
  }

  return {
    nodeEnv,
    dbEnv,
    databaseUrl,
    dbHost: parseDbHost(databaseUrl),
  };
};

const assertDevGuards = (ctx: SeedContext): void => {
  if (ctx.nodeEnv === "production") {
    throw new Error("[seed-dev] Blocked: NODE_ENV=production is not allowed for dev seeding.");
  }

  if (ctx.dbEnv === "production") {
    throw new Error("[seed-dev] Blocked: DB_ENV=production is not allowed for dev seeding.");
  }

  if (PROD_TOKEN_PATTERN.test(ctx.databaseUrl)) {
    throw new Error(
      "[seed-dev] Blocked: DATABASE_URL contains 'production'. Refusing to run."
    );
  }

  if (!ctx.dbEnv) {
    throw new Error(
      "[seed-dev] Blocked: DB_ENV is required for dev seeding (set DB_ENV=development)."
    );
  }

  if (ctx.dbEnv !== "development" && ctx.dbEnv !== "test") {
    throw new Error(
      `[seed-dev] Blocked: unsupported DB_ENV='${ctx.dbEnv}'. Allowed: development,test.`
    );
  }

  const looksRemote = !LOCAL_DB_PATTERN.test(ctx.dbHost);
  if (looksRemote && process.env.ALLOW_REMOTE_DEV_SEED !== "true") {
    throw new Error(
      "[seed-dev] Blocked: remote DATABASE_URL detected. Set ALLOW_REMOTE_DEV_SEED=true to authorize."
    );
  }
};

const shouldReset = (): boolean => process.env.SEED_RESET === "true";

const cleanupDevData = async (): Promise<void> => {
  console.warn("[seed-dev] SEED_RESET=true detected. Running deleteMany cleanup for dev database.");

  // Delete in reverse dependency order to satisfy foreign keys.
  await prisma.chatMessage.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.report.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.cartEvent.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.orderQuotationLog.deleteMany();
  await prisma.orderAddressSnapshot.deleteMany();
  await prisma.orderReservation.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dealerPriceMapping.deleteMany();
  await prisma.dealerProfile.deleteMany();
  await prisma.restock.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.productVariantAttribute.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.categoryAttribute.deleteMany();
  await prisma.attributeValue.deleteMany();
  await prisma.attribute.deleteMany();
  await prisma.category.deleteMany();
  await prisma.deliveryRate.deleteMany();
  await prisma.deliveryStateRate.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.log.deleteMany();
  await prisma.address.deleteMany();
  await prisma.invoiceCounter.deleteMany();
  await prisma.user.deleteMany();
};

export const seedDev = async (): Promise<void> => {
  const ctx = readSeedContext();

  console.warn(
    `[seed-dev] Booting dev seed | NODE_ENV=${ctx.nodeEnv} DB_ENV=${ctx.dbEnv} DB_HOST=${ctx.dbHost}`
  );

  assertDevGuards(ctx);

  if (shouldReset()) {
    await cleanupDevData();
  } else {
    console.warn(
      "[seed-dev] SEED_RESET is not true. Running non-destructive upserts only."
    );
  }

  const seedPassword = process.env.DEV_SEED_PASSWORD || "dev-password-placeholder";

  const adminUser = await prisma.user.upsert({
    where: { email: "dev-admin@example.com" },
    update: {
      name: "Dev Admin",
      role: ROLE.ADMIN,
    },
    create: {
      email: "dev-admin@example.com",
      name: "Dev Admin",
      password: seedPassword,
      role: ROLE.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "dev-user@example.com" },
    update: {
      name: "Dev User",
      role: ROLE.USER,
    },
    create: {
      email: "dev-user@example.com",
      name: "Dev User",
      password: seedPassword,
      role: ROLE.USER,
    },
  });

  const sewingMachinesCategory = await prisma.category.upsert({
    where: { slug: "sewing-machines" },
    update: {
      name: "Sewing Machines",
      description: "Development-only category for sewing machine testing.",
    },
    create: {
      slug: "sewing-machines",
      name: "Sewing Machines",
      description: "Development-only category for sewing machine testing.",
      images: [],
    },
  });

  const sewingAccessoriesCategory = await prisma.category.upsert({
    where: { slug: "sewing-accessories" },
    update: {
      name: "Sewing Accessories",
      description: "Development-only category for accessory flow validation.",
    },
    create: {
      slug: "sewing-accessories",
      name: "Sewing Accessories",
      description: "Development-only category for accessory flow validation.",
      images: [],
    },
  });

  const products = [
    {
      slug: "dev-portable-sewing-machine-x1",
      name: "DEV Portable Sewing Machine X1",
      description: "Dummy product for development checkout and inventory tests.",
      categoryId: sewingMachinesCategory.id,
      variants: [
        { sku: "DEV-SM-X1-WHT", price: 329.0, stock: 25, barcode: "DEV0001001" },
        { sku: "DEV-SM-X1-BLK", price: 339.0, stock: 19, barcode: "DEV0001002" },
      ],
    },
    {
      slug: "dev-industrial-overlock-pro",
      name: "DEV Industrial Overlock Pro",
      description: "Dummy overlock machine for admin pricing flow tests.",
      categoryId: sewingMachinesCategory.id,
      variants: [
        { sku: "DEV-OL-PRO-240", price: 1129.0, stock: 8, barcode: "DEV0002001" },
      ],
    },
    {
      slug: "dev-thread-kit-deluxe",
      name: "DEV Thread Kit Deluxe",
      description: "Dummy accessories pack for cart/order scenarios.",
      categoryId: sewingAccessoriesCategory.id,
      variants: [
        { sku: "DEV-THR-KIT-36", price: 49.0, stock: 140, barcode: "DEV0003001" },
        { sku: "DEV-THR-KIT-72", price: 89.0, stock: 90, barcode: "DEV0003002" },
      ],
    },
  ] as const;

  for (const productInput of products) {
    const product = await prisma.product.upsert({
      where: { slug: productInput.slug },
      update: {
        name: productInput.name,
        description: productInput.description,
        categoryId: productInput.categoryId,
        isNew: true,
        isFeatured: false,
        isTrending: false,
        isBestSeller: false,
      },
      create: {
        slug: productInput.slug,
        name: productInput.name,
        description: productInput.description,
        categoryId: productInput.categoryId,
        isNew: true,
        isFeatured: false,
        isTrending: false,
        isBestSeller: false,
      },
    });

    for (const variantInput of productInput.variants) {
      await prisma.productVariant.upsert({
        where: { sku: variantInput.sku },
        update: {
          productId: product.id,
          price: variantInput.price,
          stock: variantInput.stock,
          barcode: variantInput.barcode,
          lowStockThreshold: 5,
          images: [],
        },
        create: {
          productId: product.id,
          sku: variantInput.sku,
          price: variantInput.price,
          stock: variantInput.stock,
          barcode: variantInput.barcode,
          lowStockThreshold: 5,
          images: [],
        },
      });
    }
  }

  console.log(
    `[seed-dev] Completed dev seed successfully. Primary admin: ${adminUser.email}`
  );
};

if (require.main === module) {
  seedDev()
    .catch((error) => {
      console.error("[seed-dev] Failed:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
