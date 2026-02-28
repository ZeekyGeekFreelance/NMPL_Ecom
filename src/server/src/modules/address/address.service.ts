import AppError from "@/shared/errors/AppError";
import { AddressRepository } from "./address.repository";
import prisma from "@/infra/database/database.config";
import { ADDRESS_TYPE } from "@prisma/client";

type AddressPayload = {
  type?: ADDRESS_TYPE;
  fullName?: string;
  phoneNumber?: string;
  line1?: string;
  line2?: string | null;
  landmark?: string | null;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  isDefault?: boolean;
};

export class AddressService {
  constructor(private addressRepository: AddressRepository) {}

  private normalizeAddressInput(payload: AddressPayload) {
    const normalizeString = (value: unknown) => String(value ?? "").trim();
    const normalizeNullableString = (value: unknown) => {
      const normalized = normalizeString(value);
      return normalized ? normalized : null;
    };

    const normalizedPincode = normalizeString(payload.pincode);
    if (normalizedPincode && !/^[A-Za-z0-9-]{3,12}$/.test(normalizedPincode)) {
      throw new AppError(400, "Pincode must be between 3 and 12 characters.");
    }

    return {
      type: payload.type || ADDRESS_TYPE.HOME,
      fullName: normalizeString(payload.fullName),
      phoneNumber: normalizeString(payload.phoneNumber),
      line1: normalizeString(payload.line1),
      line2: normalizeNullableString(payload.line2),
      landmark: normalizeNullableString(payload.landmark),
      city: normalizeString(payload.city),
      state: normalizeString(payload.state),
      country: normalizeString(payload.country),
      pincode: normalizedPincode,
      isDefault: Boolean(payload.isDefault),
    };
  }

  async getUserAddresses(userId: string) {
    return this.addressRepository.findAddressesByUserId(userId);
  }

  async getAddressDetails(addressId: string, userId: string) {
    const address = await this.addressRepository.findAddressById(addressId);
    if (!address) {
      throw new AppError(404, "Address not found");
    }
    if (address.userId !== userId) {
      throw new AppError(403, "You are not authorized to view this address");
    }
    return address;
  }

  async createAddress(userId: string, payload: AddressPayload) {
    const normalized = this.normalizeAddressInput(payload);
    if (
      !normalized.fullName ||
      !normalized.phoneNumber ||
      !normalized.line1 ||
      !normalized.city ||
      !normalized.state ||
      !normalized.country ||
      !normalized.pincode
    ) {
      throw new AppError(400, "Address fields are incomplete.");
    }

    return prisma.$transaction(async (tx) => {
      const existingCount = await this.addressRepository.countUserAddresses(userId);
      const shouldMakeDefault = normalized.isDefault || existingCount === 0;
      if (shouldMakeDefault) {
        await this.addressRepository.unsetDefaultAddresses(userId, tx);
      }

      return this.addressRepository.createAddress(
        {
          userId,
          type: normalized.type,
          fullName: normalized.fullName,
          phoneNumber: normalized.phoneNumber,
          line1: normalized.line1,
          line2: normalized.line2,
          landmark: normalized.landmark,
          city: normalized.city,
          state: normalized.state,
          country: normalized.country,
          pincode: normalized.pincode,
          isDefault: shouldMakeDefault,
        },
        tx
      );
    });
  }

  async updateAddress(addressId: string, userId: string, payload: AddressPayload) {
    const existingAddress = await this.addressRepository.findAddressById(addressId);
    if (!existingAddress || existingAddress.userId !== userId) {
      throw new AppError(404, "Address not found");
    }

    const normalized = this.normalizeAddressInput(payload);
    const updateData = {
      ...(payload.type ? { type: normalized.type } : {}),
      ...(payload.fullName !== undefined ? { fullName: normalized.fullName } : {}),
      ...(payload.phoneNumber !== undefined
        ? { phoneNumber: normalized.phoneNumber }
        : {}),
      ...(payload.line1 !== undefined ? { line1: normalized.line1 } : {}),
      ...(payload.line2 !== undefined ? { line2: normalized.line2 } : {}),
      ...(payload.landmark !== undefined ? { landmark: normalized.landmark } : {}),
      ...(payload.city !== undefined ? { city: normalized.city } : {}),
      ...(payload.state !== undefined ? { state: normalized.state } : {}),
      ...(payload.country !== undefined ? { country: normalized.country } : {}),
      ...(payload.pincode !== undefined ? { pincode: normalized.pincode } : {}),
      ...(payload.isDefault !== undefined ? { isDefault: normalized.isDefault } : {}),
    };

    return prisma.$transaction(async (tx) => {
      if (payload.isDefault === true) {
        await this.addressRepository.unsetDefaultAddresses(userId, tx);
      }

      return this.addressRepository.updateAddress(addressId, updateData, tx);
    });
  }

  async setDefaultAddress(addressId: string, userId: string) {
    const existingAddress = await this.addressRepository.findAddressById(addressId);
    if (!existingAddress || existingAddress.userId !== userId) {
      throw new AppError(404, "Address not found");
    }

    await prisma.$transaction(async (tx) => {
      await this.addressRepository.unsetDefaultAddresses(userId, tx);
      await this.addressRepository.updateAddress(
        addressId,
        { isDefault: true },
        tx
      );
    });

    const updatedAddress = await this.addressRepository.findAddressById(
      addressId
    );

    if (!updatedAddress) {
      throw new AppError(500, "Default address was updated but could not be loaded");
    }

    return updatedAddress;
  }

  async deleteAddress(addressId: string, userId: string) {
    const address = await this.addressRepository.findAddressById(addressId);
    if (!address) {
      throw new AppError(404, "Address not found");
    }

    if (address.userId !== userId) {
      throw new AppError(403, "You are not authorized to delete this address");
    }

    await prisma.$transaction(async (tx) => {
      await this.addressRepository.deleteAddress(addressId, tx);

      if (address.isDefault) {
        const nextDefault = await this.addressRepository.findNextAddressForDefault(
          userId,
          addressId,
          tx
        );
        if (nextDefault) {
          await this.addressRepository.updateAddress(
            nextDefault.id,
            { isDefault: true },
            tx
          );
        }
      }
    });
  }
}
