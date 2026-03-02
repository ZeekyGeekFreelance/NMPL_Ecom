import { ApolloServer } from "@apollo/server";
import { combinedSchemas } from "../v1/schema";
import { config } from "@/config";

export const serverV2 = new ApolloServer({
  schema: combinedSchemas,
  introspection: !config.isProduction,
  includeStacktraceInErrorResponses: !config.isProduction,
});
