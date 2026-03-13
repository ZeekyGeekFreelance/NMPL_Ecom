import AppError from "@/shared/errors/AppError";
import { AddressRepository } from "./address.repository";
import prisma from "@/infra/database/database.config";
import { ADDRESS_TYPE } from "@prisma/client";
import {
  INDIA_COUNTRY_NAME,
  canonicalizeAddressCity,
  canonicalizeAddressState,
  isIndiaCountry,
} from "./address.location";

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

  private resolveCanonicalLocation(stateValue: string, cityValue: string) {
    const canonicalState = canonicalizeAddressState(stateValue);
    if (!canonicalState) {
      throw new AppError(400, "Select a valid state from the list.");
    }

    const canonicalCity = canonicalizeAddressCity(canonicalState, cityValue);
    if (!canonicalCity) {
      throw new AppError(400, "Select a valid city for the selected state.");
    }

    return {
      state: canonicalState,
      city: canonicalCity,
    };
  }

  private normalizeAddressInput(payload: AddressPayload) {
    const normalizeString = (value: unknown) =>
      String(value ?? "").replace(/[<>`]/g, "").trim();
    const normalizeSingleSpaced = (value: unknown) =>
      normalizeString(value).replace(/\s+/g, " ");
    const normalizeNullableString = (value: unknown) => {
      const normalized = normalizeSingleSpaced(value);
      return normalized ? normalized : null;
    };

    const normalizedFullName = normalizeSingleSpaced(payload.fullName);
    const normalizedLine1 = normalizeSingleSpaced(payload.line1);
    const normalizedCity = normalizeSingleSpaced(payload.city);
    const normalizedState = normalizeSingleSpaced(payload.state);
    const normalizedCountry = normalizeSingleSpaced(payload.country);

    const normalizedPincode = normalizeString(payload.pincode);
    if (normalizedPincode && !/^\d{6}$/.test(normalizedPincode)) {
      throw new AppError(400, "Pincode must be exactly 6 digits.");
    }
    const normalizedPhoneNumber = normalizeString(payload.phoneNumber);
    if (normalizedPhoneNumber && !/^\d{10}$/.test(normalizedPhoneNumber)) {
      throw new AppError(400, "Phone number must be exactly 10 digits.");
    }

    if (normalizedFullName && (normalizedFullName.length < 2 || normalizedFullName.length > 120)) {
      throw new AppError(400, "Full name must be between 2 and 120 characters.");
    }

    if (normalizedLine1 && (normalizedLine1.length < 5 || normalizedLine1.length > 255)) {
      throw new AppError(
        400,
        "Address line 1 must be between 5 and 255 characters."
      );
    }

    if (normalizedCity && (normalizedCity.length < 2 || normalizedCity.length > 120)) {
      throw new AppError(400, "City must be between 2 and 120 characters.");
    }

    if (normalizedState && (normalizedState.length < 2 || normalizedState.length > 120)) {
      throw new AppError(400, "State must be between 2 and 120 characters.");
    }

    if (
      normalizedCountry &&
      (normalizedCountry.length < 2 || normalizedCountry.length > 120)
    ) {
      throw new AppError(400, "Country must be between 2 and 120 characters.");
    }
    if (normalizedCountry && !isIndiaCountry(normalizedCountry)) {
      throw new AppError(400, `Country must be ${INDIA_COUNTRY_NAME}.`);
    }

    const normalizedLine2 = normalizeNullableString(payload.line2);
    if (normalizedLine2 && normalizedLine2.length > 255) {
      throw new AppError(400, "Address line 2 cannot exceed 255 characters.");
    }

    const normalizedLandmark = normalizeNullableString(payload.landmark);
    if (normalizedLandmark && normalizedLandmark.length > 255) {
      throw new AppError(400, "Landmark cannot exceed 255 characters.");
    }

    return {
      type: payload.type || ADDRESS_TYPE.HOME,
      fullName: normalizedFullName,
      phoneNumber: normalizedPhoneNumber,
      line1: normalizedLine1,
      line2: normalizedLine2,
      landmark: normalizedLandmark,
      city: normalizedCity,
      state: normalizedState,
      country: normalizedCountry ? INDIA_COUNTRY_NAME : "",
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
    if (!normalized.fullName) throw new AppError(400, "Full name is required.");
    if (!normalized.phoneNumber)
      throw new AppError(400, "Phone number is required.");
    if (!normalized.line1)
      throw new AppError(400, "Address line 1 is required.");
    if (!normalized.city) throw new AppError(400, "City is required.");
    if (!normalized.state) throw new AppError(400, "State is required.");
    if (!normalized.country) throw new AppError(400, "Country is required.");
    if (!normalized.pincode) throw new AppError(400, "Pincode is required.");
    const canonicalLocation = this.resolveCanonicalLocation(
      normalized.state,
      normalized.city
    );

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
          city: canonicalLocation.city,
          state: canonicalLocation.state,
          country: INDIA_COUNTRY_NAME,
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
    const effectiveState =
      payload.state !== undefined ? normalized.state : existingAddress.state;
    const effectiveCity =
      payload.city !== undefined ? normalized.city : existingAddress.city;
    const shouldValidateLocation =
      payload.state !== undefined || payload.city !== undefined;
    const canonicalLocation = shouldValidateLocation
      ? this.resolveCanonicalLocation(effectiveState, effectiveCity)
      : null;
    const updateData = {
      ...(payload.type ? { type: normalized.type } : {}),
      ...(payload.fullName !== undefined ? { fullName: normalized.fullName } : {}),
      ...(payload.phoneNumber !== undefined
        ? { phoneNumber: normalized.phoneNumber }
        : {}),
      ...(payload.line1 !== undefined ? { line1: normalized.line1 } : {}),
      ...(payload.line2 !== undefined ? { line2: normalized.line2 } : {}),
      ...(payload.landmark !== undefined ? { landmark: normalized.landmark } : {}),
      ...(payload.city !== undefined && canonicalLocation
        ? { city: canonicalLocation.city }
        : {}),
      ...(payload.state !== undefined && canonicalLocation
        ? { state: canonicalLocation.state }
        : {}),
      ...(payload.country !== undefined ? { country: INDIA_COUNTRY_NAME } : {}),
      ...(payload.pincode !== undefined ? { pincode: normalized.pincode } : {}),
      ...(payload.isDefault !== undefined ? { isDefault: normalized.isDefault } : {}),
    };

    if (Object.keys(updateData).length === 0) {
      throw new AppError(400, "At least one address field is required to update.");
    }

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
