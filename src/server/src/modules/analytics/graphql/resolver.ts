import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import productPerformance from "./resolvers/productPerformance";
import yearRange from "./resolvers/yearRange";
import interactionAnalytics from "./resolvers/interactionAnalytics";
import { searchDashboardResolver } from "./resolvers/searchDashboard";
import orderAnalytics from "./resolvers/orderAnalytics";
import revenueAnalytics from "./resolvers/revenueAnalytics";
import userAnalytics from "./resolvers/userAnalytics";
import abandonedCartAnalytics from "./resolvers/abandonedCartAnalytics";

export interface Context {
  prisma: PrismaClient;
  req: Request;
  res: Response;
}

type QueryResolver = (
  parent: unknown,
  args: unknown,
  context: Context,
  info: unknown
) => Promise<unknown> | unknown;

const DASHBOARD_ROLES = new Set(["ADMIN", "SUPERADMIN"]);

const withDashboardAuthorization = (resolver: QueryResolver): QueryResolver => {
  return async (parent, args, context, info) => {
    const role = context?.req?.user?.role || (context as any)?.user?.role;

    if (!role || !DASHBOARD_ROLES.has(role)) {
      throw new Error("Forbidden");
    }

    return resolver(parent, args, context, info);
  };
};

const queryResolvers = {
  ...orderAnalytics.Query,
  ...revenueAnalytics.Query,
  ...userAnalytics.Query,
  ...yearRange.Query,
  ...interactionAnalytics.Query,
  ...productPerformance.Query,
  ...searchDashboardResolver.Query,
  ...abandonedCartAnalytics.Query,
} as unknown as Record<string, QueryResolver>;

export const analyticsResolvers = {
  Query: Object.fromEntries(
    Object.entries(queryResolvers).map(([name, resolver]) => [
      name,
      withDashboardAuthorization(resolver),
    ])
  ),
};
