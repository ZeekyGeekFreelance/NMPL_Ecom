/**
 * One-time migration: bcrypt-hash any plain-text passwords remaining in the
 * User table (legacy data or seed accounts).
 *
 * Run before deploying the auth.service.ts fix that removed plain-text comparison:
 *   npx ts-node -r dotenv/config scripts/migrate-passwords.ts
 *
 * Safe to run multiple times — already-hashed rows are skipped.
 */
import prisma from "../src/infra/database/database.config";
import { passwordUtils } from "../src/shared/utils/authUtils";

const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/;

async function main() {
  console.log("[migrate-passwords] Scanning for plain-text passwords...");

  const users = await prisma.user.findMany({
    select: { id: true, email: true, password: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.password) {
      skipped++;
      continue; // OAuth user — no password
    }

    if (BCRYPT_PATTERN.test(user.password)) {
      skipped++;
      continue; // Already hashed
    }

    // Plain-text found — hash and update
    const hashed = await passwordUtils.hashPassword(user.password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        tokenVersion: { increment: 1 }, // Invalidate all existing sessions
      },
    });

    console.log(`  [migrated] ${user.email} (${user.id.slice(0, 8)}...)`);
    migrated++;
  }

  console.log(`\n[migrate-passwords] Done. Migrated: ${migrated} | Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[migrate-passwords] FAILED:", err);
  process.exit(1);
});
