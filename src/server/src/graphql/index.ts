import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { combinedSchemas } from "./v1/schema";
import optionalAuth from "@/shared/middlewares/optionalAuth";
import prisma from "@/infra/database/database.config";
import { parse } from "graphql/language/parser";
import { Kind } from "graphql/language/kinds";
import { FieldNode, OperationDefinitionNode } from "graphql/language/ast";

const PUBLIC_CATALOG_ROOT_FIELDS = new Set([
  "__typename",
  "products",
  "product",
  "newProducts",
  "featuredProducts",
  "trendingProducts",
  "bestSellerProducts",
  "categories",
]);

const resolveRequestedOperation = (
  document: ReturnType<typeof parse>,
  operationName: string | null
): OperationDefinitionNode | null => {
  const operations = document.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION
  );

  if (operations.length === 0) {
    return null;
  }

  if (operationName) {
    return (
      operations.find(
        (operation) => operation.name?.value === operationName
      ) || null
    );
  }

  return operations[0];
};

const isPublicCatalogOperation = (req: express.Request): boolean => {
  if (!req.body || Array.isArray(req.body)) {
    return false;
  }

  const body = req.body as { query?: unknown; operationName?: unknown };
  if (typeof body.query !== "string" || body.query.trim().length === 0) {
    return false;
  }

  const operationName =
    typeof body.operationName === "string" ? body.operationName : null;

  try {
    const document = parse(body.query);
    const operation = resolveRequestedOperation(document, operationName);
    if (!operation || operation.operation !== "query") {
      return false;
    }

    const rootFieldNames = operation.selectionSet.selections
      .filter(
        (selection): selection is FieldNode => selection.kind === Kind.FIELD
      )
      .map((selection) => selection.name.value);

    return (
      rootFieldNames.length > 0 &&
      rootFieldNames.every((fieldName) =>
        PUBLIC_CATALOG_ROOT_FIELDS.has(fieldName)
      )
    );
  } catch {
    return false;
  }
};

const optionalAuthForNonCatalogQueries: express.RequestHandler = (
  req,
  res,
  next
) => {
  if (isPublicCatalogOperation(req)) {
    next();
    return;
  }

  void optionalAuth(req, res, next);
};

export async function configureGraphQL(app: express.Application) {
  const apolloServer = new ApolloServer({
    schema: combinedSchemas,
  });
  await apolloServer.start();

  app.use(
    "/api/v1/graphql",
    optionalAuthForNonCatalogQueries,
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => ({
        req,
        res,
        prisma,
        user: (req as any).user,
      }),
    })
  );
}
