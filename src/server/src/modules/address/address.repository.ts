import { ADDRESS_TYPE, Prisma } from "@prisma/client";
import prisma from "@/infra/database/database.config";

type AddressCreateInput = {
  userId: string;
  type: ADDRESS_TYPE;
  fullName: string;
  phoneNumber: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
  isDefault: boolean;
};

type AddressUpdateInput = Partial<
  Omit<AddressCreateInput, "userId" | "isDefault"> & { isDefault: boolean }
>;

export class AddressRepository {
  async findAddressesByUserId(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
  }

  async findAddressById(addressId: string) {
    return prisma.address.findUnique({
      where: { id: addressId },
    });
  }

  async createAddress(data: AddressCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.address.create({
      data,
    });
  }

  async updateAddress(
    addressId: string,
    data: AddressUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.address.update({
      where: { id: addressId },
      data,
    });
  }

  async unsetDefaultAddresses(userId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    await client.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  async countUserAddresses(userId: string) {
    return prisma.address.count({
      where: { userId },
    });
  }

  async findNextAddressForDefault(
    userId: string,
    excludeAddressId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.address.findFirst({
      where: {
        userId,
        id: {
          not: excludeAddressId,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  }

  async deleteAddress(addressId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.address.delete({
      where: { id: addressId },
    });
  }
}
