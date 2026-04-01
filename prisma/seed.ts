import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Super admin
  const superAdminPassword = await bcrypt.hash("password123", 12);
  await prisma.user.upsert({
    where: { email: "superadmin@example.com" },
    update: {},
    create: { name: "Super Admin", email: "superadmin@example.com", password: superAdminPassword, role: "SUPERADMIN" },
  });

  // Admin
  const adminPassword = await bcrypt.hash("password123", 12);
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { name: "Admin User", email: "admin@example.com", password: adminPassword, role: "ADMIN" },
  });

  // Regular user
  const userPassword = await bcrypt.hash("password123", 12);
  await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: { name: "Test User", email: "user@example.com", password: userPassword, role: "USER" },
  });

  // Sample category
  const category = await prisma.category.upsert({
    where: { slug: "sample-category" },
    update: {},
    create: { name: "Sample Category", slug: "sample-category", description: "A sample product category" },
  });

  // Sample GST slab
  const gst18 = await prisma.gst.upsert({
    where: { rate: 18 },
    update: {},
    create: { name: "GST 18%", rate: 18, isActive: true },
  });

  console.log("✅ Seed complete");
  console.log("   Credentials:");
  console.log("   superadmin@example.com / password123");
  console.log("   admin@example.com / password123");
  console.log("   user@example.com / password123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
