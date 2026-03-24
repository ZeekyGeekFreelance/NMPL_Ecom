/* eslint-disable no-console */
require("./load-env");

const { PrismaClient, ROLE } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const [rawRole, rawEmail, rawName, rawPassword, rawPhone] = args;

const usage = () => {
  console.error(
    "[bootstrap-privileged-user] Usage: node ./scripts/bootstrap-privileged-user.js <SUPERADMIN|ADMIN> <email> <name> <temporaryPassword> [phone]"
  );
};

const normalizeRole = (value) => String(value || "").trim().toUpperCase();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeName = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();
const normalizePhone = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return undefined;
  }
  if (!/^\d{10}$/.test(normalized)) {
    throw new Error(
      "[bootstrap-privileged-user] Phone number must be exactly 10 digits when provided."
    );
  }
  return normalized;
};

const assertStrongPassword = (password) => {
  const value = String(password || "").trim();
  if (value.length < 8) {
    throw new Error("[bootstrap-privileged-user] Password must be at least 8 characters long.");
  }
  if (!/[A-Z]/.test(value)) {
    throw new Error("[bootstrap-privileged-user] Password must contain at least one uppercase letter.");
  }
  if (!/[a-z]/.test(value)) {
    throw new Error("[bootstrap-privileged-user] Password must contain at least one lowercase letter.");
  }
  if (!/[0-9]/.test(value)) {
    throw new Error("[bootstrap-privileged-user] Password must contain at least one number.");
  }
  if (!/[!@#$%^&*]/.test(value)) {
    throw new Error(
      "[bootstrap-privileged-user] Password must contain at least one special character (!@#$%^&*)."
    );
  }
  return value;
};

const main = async () => {
  const role = normalizeRole(rawRole);
  if (!rawRole || !rawEmail || !rawName || !rawPassword) {
    usage();
    process.exit(1);
  }

  if (role !== ROLE.SUPERADMIN && role !== ROLE.ADMIN) {
    throw new Error(
      "[bootstrap-privileged-user] Role must be SUPERADMIN or ADMIN."
    );
  }

  const email = normalizeEmail(rawEmail);
  const name = normalizeName(rawName);
  const password = assertStrongPassword(rawPassword);
  const phone = normalizePhone(rawPhone);

  if (!email || !email.includes("@")) {
    throw new Error("[bootstrap-privileged-user] A valid email is required.");
  }

  if (name.length < 2 || name.length > 80) {
    throw new Error(
      "[bootstrap-privileged-user] Name must be between 2 and 80 characters."
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      role: true,
      email: true,
    },
  });

  if (existingUser) {
    throw new Error(
      `[bootstrap-privileged-user] User '${existingUser.email}' already exists with role ${existingUser.role}. Refusing to overwrite or promote an existing account.`
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const createdUser = await prisma.user.create({
    data: {
      email,
      name,
      phone,
      password: hashedPassword,
      role,
      mustChangePassword: true,
      isBillingSupervisor: false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      mustChangePassword: true,
    },
  });

  console.log(
    `[bootstrap-privileged-user] Created ${createdUser.role} '${createdUser.email}'.`
  );
  console.log(
    "[bootstrap-privileged-user] First sign-in will require an immediate password change."
  );
};

main()
  .catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : `[bootstrap-privileged-user] ${String(error)}`
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
