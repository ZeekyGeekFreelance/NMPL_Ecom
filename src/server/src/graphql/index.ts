import express from "express";
import bodyParser from "body-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { combinedSchemas } from "./v1/schema";
import optionalAuth from "@/shared/middlewares/optionalAuth";
import prisma from "@/infra/database/database.config";

export async function configureGraphQL(app: express.Application) {
  const apolloServer = new ApolloServer({
    schema: combinedSchemas,
  });
  await apolloServer.start();

  app.use(
    "/api/v1/graphql",
    optionalAuth,
    bodyParser.json(),
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
