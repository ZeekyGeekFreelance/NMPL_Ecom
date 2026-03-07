import { Prisma } from "@prisma/client";
import prisma from "../src/infra/database/database.config";
import { normalizeHumanTextForField } from "../src/shared/utils/textNormalization";

type Counter = {
  scanned: number;
  updated: number;
  skipped: number;
};

const normalizeText = (value: string | null | undefined, fieldHint: string) => {
  if (typeof value !== "string") {
    return value;
  }

  return normalizeHumanTextForField(value, fieldHint);
};

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

const normalizeUsers = async (): Promise<Counter> => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true },
  });

  let updated = 0;
  let skipped = 0;
  for (const user of users) {
    const nextName = normalizeText(user.name, "name");
    if (nextName === user.name) {
      continue;
    }

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: nextName ?? user.name },
      });
      updated += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        skipped += 1;
        console.warn(
          `[normalize-title-case] User skipped due unique conflict (id=${user.id})`
        );
        continue;
      }
      throw error;
    }
  }

  return { scanned: users.length, updated, skipped };
};

const normalizeDealerProfiles = async (): Promise<Counter> => {
  const dealers = await prisma.dealerProfile.findMany({
    select: { id: true, businessName: true },
  });

  let updated = 0;
  let skipped = 0;
  for (const dealer of dealers) {
    const nextBusinessName = normalizeText(dealer.businessName, "businessName");
    if (nextBusinessName === dealer.businessName) {
      continue;
    }

    try {
      await prisma.dealerProfile.update({
        where: { id: dealer.id },
        data: { businessName: nextBusinessName },
      });
      updated += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        skipped += 1;
        console.warn(
          `[normalize-title-case] DealerProfile skipped due unique conflict (id=${dealer.id})`
        );
        continue;
      }
      throw error;
    }
  }

  return { scanned: dealers.length, updated, skipped };
};

const normalizeCategories = async (): Promise<Counter> => {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
  });

  let updated = 0;
  let skipped = 0;
  for (const category of categories) {
    const nextName = normalizeText(category.name, "categoryName");
    if (nextName === category.name) {
      continue;
    }

    try {
      await prisma.category.update({
        where: { id: category.id },
        data: { name: nextName ?? category.name },
      });
      updated += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        skipped += 1;
        console.warn(
          `[normalize-title-case] Category skipped due unique conflict (id=${category.id})`
        );
        continue;
      }
      throw error;
    }
  }

  return { scanned: categories.length, updated, skipped };
};

const normalizeProducts = async (): Promise<Counter> => {
  const products = await prisma.product.findMany({
    select: { id: true, name: true },
  });

  let updated = 0;
  let skipped = 0;
  for (const product of products) {
    const nextName = normalizeText(product.name, "productName");
    if (nextName === product.name) {
      continue;
    }

    try {
      await prisma.product.update({
        where: { id: product.id },
        data: { name: nextName ?? product.name },
      });
      updated += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        skipped += 1;
        console.warn(
          `[normalize-title-case] Product skipped due unique conflict (id=${product.id})`
        );
        continue;
      }
      throw error;
    }
  }

  return { scanned: products.length, updated, skipped };
};

const normalizeAddresses = async (): Promise<Counter> => {
  const addresses = await prisma.address.findMany({
    select: {
      id: true,
      fullName: true,
      line1: true,
      line2: true,
      landmark: true,
      city: true,
      state: true,
      country: true,
    },
  });

  let updated = 0;
  let skipped = 0;
  for (const address of addresses) {
    const nextData = {
      fullName: normalizeText(address.fullName, "fullName") ?? address.fullName,
      line1: normalizeText(address.line1, "line1") ?? address.line1,
      line2: normalizeText(address.line2, "line2"),
      landmark: normalizeText(address.landmark, "landmark"),
      city: normalizeText(address.city, "city") ?? address.city,
      state: normalizeText(address.state, "state") ?? address.state,
      country: normalizeText(address.country, "country") ?? address.country,
    };

    const hasChanges =
      nextData.fullName !== address.fullName ||
      nextData.line1 !== address.line1 ||
      nextData.line2 !== address.line2 ||
      nextData.landmark !== address.landmark ||
      nextData.city !== address.city ||
      nextData.state !== address.state ||
      nextData.country !== address.country;

    if (!hasChanges) {
      continue;
    }

    try {
      await prisma.address.update({
        where: { id: address.id },
        data: nextData,
      });
      updated += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        skipped += 1;
        console.warn(
          `[normalize-title-case] Address skipped due unique conflict (id=${address.id})`
        );
        continue;
      }
      throw error;
    }
  }

  return { scanned: addresses.length, updated, skipped };
};

const printCounter = (label: string, counter: Counter) => {
  console.log(
    `[normalize-title-case] ${label}: scanned=${counter.scanned} updated=${counter.updated} skipped=${counter.skipped}`
  );
};

const run = async () => {
  const [users, dealers, categories, products, addresses] = await Promise.all([
    normalizeUsers(),
    normalizeDealerProfiles(),
    normalizeCategories(),
    normalizeProducts(),
    normalizeAddresses(),
  ]);

  printCounter("User", users);
  printCounter("DealerProfile", dealers);
  printCounter("Category", categories);
  printCounter("Product", products);
  printCounter("Address", addresses);
};

run()
  .catch((error) => {
    console.error("[normalize-title-case] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
