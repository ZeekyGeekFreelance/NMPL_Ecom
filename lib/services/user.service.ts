import prisma from "@/lib/db";
import { AppError } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, role: true, avatar: true,
      phone: true, createdAt: true, isBillingSupervisor: true, mustChangePassword: true,
      dealerProfile: true,
    },
  });
  if (!user) throw new AppError(404, "User not found");
  return user;
}

export async function updateUser(id: string, data: {
  name?: string;
  phone?: string;
  avatar?: string;
}) {
  return prisma.user.update({
    where: { id },
    data: { name: data.name, phone: data.phone, avatar: data.avatar },
    select: { id: true, email: true, name: true, role: true, avatar: true, phone: true },
  });
}

export async function getAddresses(userId: string) {
  return prisma.address.findMany({ where: { userId }, orderBy: { isDefault: "desc" } });
}

export async function createAddress(userId: string, data: {
  fullName: string; phoneNumber: string; line1: string; line2?: string;
  landmark?: string; city: string; state: string; country: string;
  pincode: string; type?: string; isDefault?: boolean;
}) {
  if (data.isDefault) {
    await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
  }
  return prisma.address.create({
    data: { ...data, userId, type: (data.type as any) ?? "HOME" },
  });
}

export async function deleteAddress(userId: string, addressId: string) {
  const addr = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!addr) throw new AppError(404, "Address not found");
  await prisma.address.delete({ where: { id: addressId } });
}

// Admin: list all users
export async function listUsers(page = 1, limit = 20, search?: string) {
  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, name: true, role: true, avatar: true,
        phone: true, createdAt: true, isBillingSupervisor: true,
        dealerProfile: { select: { status: true, businessName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function createAdminUser(data: {
  name: string; email: string; password: string;
}) {
  const email = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "Email already registered");
  const hashed = await hashPassword(data.password);
  return prisma.user.create({
    data: { name: data.name, email, password: hashed, role: "ADMIN", mustChangePassword: true },
    select: { id: true, email: true, name: true, role: true },
  });
}
