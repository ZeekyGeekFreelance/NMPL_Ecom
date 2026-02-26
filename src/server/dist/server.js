"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("reflect-metadata");
const module_alias_1 = require("module-alias");
const path_1 = __importDefault(require("path"));
// Resolve to current runtime root: `src` during ts-node, `dist` after build.
const runtimeRoot = path_1.default.resolve(__dirname);
(0, module_alias_1.addAlias)("@", runtimeRoot);
const app_1 = require("./app");
const PORT = process.env.PORT || 5000;
function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        const { httpServer } = yield (0, app_1.createApp)();
        httpServer.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
        httpServer.on("error", (err) => {
            console.error("Server error:", err);
            process.exit(1);
        });
    });
}
bootstrap();
