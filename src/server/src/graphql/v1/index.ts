import { ApolloServer } from "@apollo/server";
import { combinedSchemas } from "./schema";
import { config } from "@/config";

export const serverV1 = new ApolloServer({
  schema: combinedSchemas,
  introspection: !config.isProduction,
  includeStacktraceInErrorResponses: !config.isProduction,
});
