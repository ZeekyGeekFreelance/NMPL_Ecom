import prisma from "@/infra/database/database.config";

export class ReportsRepository {
  async createReport(data: {
    type: string;
    format: string;
    userId: string;
    parameters: any;
    filePath: string | null;
  }) {
    return prisma.report.create({
      data: {
        type: data.type,
        format: data.format,
        userId: data.userId,
        parameters: data.parameters,
        filePath: data.filePath,
        createdAt: new Date(),
      },
    });
  }
}
