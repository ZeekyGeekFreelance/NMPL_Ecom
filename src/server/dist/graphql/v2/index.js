"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverV2 = void 0;
const server_1 = require("@apollo/server");
const schema_1 = require("../v1/schema");
const config_1 = require("@/config");
exports.serverV2 = new server_1.ApolloServer({
    schema: schema_1.combinedSchemas,
    introspection: !config_1.config.isProduction,
    includeStacktraceInErrorResponses: !config_1.config.isProduction,
});
