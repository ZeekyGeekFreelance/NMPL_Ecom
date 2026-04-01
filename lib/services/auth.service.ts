import crypto from "crypto";
import prisma from "@/lib/db";
import { hashPassword, comparePassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/tokens";
import { AppError } from "@/lib/api";
import { sendEmail } from "@/lib/email/sender";
import { config } from "@/lib/config";
import type { ROLE } from "@prisma/client";

export async function signIn(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.password) throw new AppError(401, "Invalid credentials");

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new AppError(401, "Invalid credentials");

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
      mustChangePassword: user.mustChangePassword,
    }),
    signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion }),
  ]);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const email = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "Email already registered");

  const hashed = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: { name: data.name.trim(), email, password: hashed, phone: data.phone },
    select: { id: true, email: true, name: true, role: true, avatar: true, mustChangePassword: true },
  });

  // Create empty cart
  await prisma.cart.create({ data: { userId: user.id } }).catch(() => {});

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: user.id, email: user.email, role: user.role, tokenVersion: 0 }),
    signRefreshToken({ sub: user.id, tokenVersion: 0 }),
  ]);

  return { accessToken, refreshToken, user };
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  // Always respond success to prevent email enumeration
  if (!user) return;

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetPasswordToken: token, resetPasswordTokenExpiresAt: expiresAt },
  });

  const resetUrl = `${config.appUrl}/password-reset/${token}`;
  await sendEmail({
    to: user.email,
    subject: `Reset your ${config.platformName} password`,
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
  });
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: token,
      resetPasswordTokenExpiresAt: { gt: new Date() },
    },
  });
  if (!user) throw new AppError(400, "Invalid or expired reset token");

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      resetPasswordToken: null,
      resetPasswordTokenExpiresAt: null,
      tokenVersion: { increment: 1 },
    },
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.password) throw new AppError(404, "User not found");

  const valid = await comparePassword(currentPassword, user.password);
  if (!valid) throw new AppError(401, "Current password is incorrect");

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashed,
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
  });
}

export async function registerDealer(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  businessName?: string;
}) {
  const email = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "Email already registered");

  const hashed = await hashPassword(data.password);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: data.name.trim(),
        email,
        password: hashed,
        phone: data.phone,
        role: "DEALER",
      },
    });
    await tx.dealerProfile.create({
      data: {
        id: newUser.id,
        userId: newUser.id,
        businessName: data.businessName,
        contactPhone: data.phone,
        status: "PENDING",
      },
    });
    return newUser;
  });

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: user.id, email: user.email, role: user.role, tokenVersion: 0 }),
    signRefreshToken({ sub: user.id, tokenVersion: 0 }),
  ]);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}
