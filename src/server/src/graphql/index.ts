import express from "express";
import { ApolloServer } from "@apollo/server";
import type { Request, Response } from "express";
import { combinedSchemas } from "./v1/schema";
import optionalAuth from "@/shared/middlewares/optionalAuth";
import prisma from "@/infra/database/database.config";
import { graphqlRateLimiter } from "@/shared/middlewares/rateLimiter";
import { GraphQLError } from "graphql/error";
import { specifiedRules } from "graphql/validation";

const { expressMiddleware } = require("@as-integrations/express4") as {
  expressMiddleware: any;
};

const MAX_QUERY_DEPTH = 6;

const measureDepth = (selectionSet: any, depth = 0): number => {
  if (!selectionSet?.selections) return depth;
  return Math.max(
    ...selectionSet.selections.map((sel: any) =>
      measureDepth(sel.selectionSet, depth + 1)
    )
  );
};

const depthLimitRule = (context: any) => ({
  OperationDefinition(node: any) {
    const depth = measureDepth(node.selectionSet);
    if (depth > MAX_QUERY_DEPTH) {
      context.reportError(
        new GraphQLError(
          `Query depth ${depth} exceeds maximum allowed depth of ${MAX_QUERY_DEPTH}.`
        )
      );
    }
  },
});

export async function configureGraphQL(app: express.Application) {
  const apolloServer = new ApolloServer({
    schema: combinedSchemas,
    allowBatchedHttpRequests: true,
    validationRules: [...specifiedRules, depthLimitRule],
  });
  await apolloServer.start();

  app.use(
    "/api/v1/graphql",
    graphqlRateLimiter,
    optionalAuth,
    expressMiddleware(apolloServer, {
      context: async ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
        prisma,
        user: req.user,
      }),
    })
  );
}
