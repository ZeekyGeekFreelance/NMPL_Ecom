import prisma from "@/infra/database/database.config";
import AppError from "@/shared/errors/AppError";
import { normalizeHumanTextForField } from "@/shared/utils/textNormalization";

type UpsertGstPayload = {
  name: string;
  rate: number;
};

export class GstService {
  private normalizeRate(rate: number): number {
    const normalizedRate = Number(rate);
    if (!Number.isFinite(normalizedRate) || normalizedRate < 0 || normalizedRate > 100) {
      throw new AppError(400, "GST rate must be between 0 and 100.");
    }

    return Number(normalizedRate.toFixed(2));
  }

  private normalizeName(name: string): string {
    const normalizedName = normalizeHumanTextForField(name, "gst name");
    if (!normalizedName) {
      throw new AppError(400, "GST name is required.");
    }

    return normalizedName;
  }

  private async assertUniqueRate(rate: number, excludeId?: string) {
    const existing = await prisma.gst.findFirst({
      where: {
        rate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppError(409, "A GST master with this rate already exists.");
    }
  }

  async getAllGsts() {
    return prisma.gst.findMany({
      orderBy: [{ isActive: "desc" }, { rate: "asc" }, { createdAt: "asc" }],
    });
  }

  async createGst(payload: UpsertGstPayload) {
    const name = this.normalizeName(payload.name);
    const rate = this.normalizeRate(payload.rate);

    await this.assertUniqueRate(rate);

    return prisma.gst.create({
      data: {
        name,
        rate,
      },
    });
  }

  async updateGst(id: string, payload: UpsertGstPayload) {
    const existing = await prisma.gst.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, "GST master not found.");
    }

    const name = this.normalizeName(payload.name);
    const rate = this.normalizeRate(payload.rate);

    await this.assertUniqueRate(rate, id);

    return prisma.gst.update({
      where: { id },
      data: {
        name,
        rate,
      },
    });
  }

  async setActivation(id: string, isActive: boolean) {
    const existing = await prisma.gst.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      throw new AppError(404, "GST master not found.");
    }

    if (existing.isActive === isActive) {
      return prisma.gst.findUnique({
        where: { id },
      });
    }

    if (!isActive) {
      const mappedProductsCount = await prisma.product.count({
        where: {
          gstId: id,
          isDeleted: false,
        },
      });

      if (mappedProductsCount > 0) {
        throw new AppError(
          409,
          "Cannot deactivate a GST master that is still assigned to products."
        );
      }
    }

    return prisma.gst.update({
      where: { id },
      data: { isActive },
    });
  }
}
