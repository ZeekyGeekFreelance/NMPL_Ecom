import { ReportsService } from "./reports.service";
import { ReportsRepository } from "./reports.repository";
import { AnalyticsRepository } from "../analytics/analytics.repository";
import { ReportsController } from "./reports.controller";

export function makeReportsController() {
  const reportsRepository = new ReportsRepository();
  const analyticsRepository = new AnalyticsRepository();
  const reportsService = new ReportsService(
    reportsRepository,
    analyticsRepository
  );
  const controller = new ReportsController(reportsService);

  return controller;
}
