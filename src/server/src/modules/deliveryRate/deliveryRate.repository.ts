import prisma from "@/infra/database/database.config";

export class DeliveryRateRepository {
  async findAllStateRates() {
    return prisma.deliveryStateRate.findMany({
      orderBy: {
        state: "asc",
      },
    });
  }

  async findStateRateByState(state: string) {
    return prisma.deliveryStateRate.findUnique({
      where: {
        state,
      },
    });
  }

  async upsertStateRate(params: {
    state: string;
    charge: number;
    isServiceable: boolean;
  }) {
    return prisma.deliveryStateRate.upsert({
      where: {
        state: params.state,
      },
      update: {
        charge: params.charge,
        isServiceable: params.isServiceable,
      },
      create: {
        state: params.state,
        charge: params.charge,
        isServiceable: params.isServiceable,
      },
    });
  }

  async deleteStateRateByState(state: string) {
    return prisma.deliveryStateRate.delete({
      where: {
        state,
      },
    });
  }
}
