"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurePdfFonts = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const CUSTOM_REGULAR_ENV = process.env.PDF_FONT_REGULAR_PATH;
const CUSTOM_BOLD_ENV = process.env.PDF_FONT_BOLD_PATH;
const REGULAR_FONT_NAME = "NMPL-Regular";
const BOLD_FONT_NAME = "NMPL-Bold";
const toAbsolutePath = (inputPath) => path_1.default.isAbsolute(inputPath)
    ? inputPath
    : path_1.default.resolve(process.cwd(), inputPath);
const firstExistingPath = (candidates) => {
    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }
        const normalized = candidate.trim();
        if (!normalized) {
            continue;
        }
        const absolute = toAbsolutePath(normalized);
        if (fs_1.default.existsSync(absolute)) {
            return absolute;
        }
    }
    return null;
};
const REGULAR_CANDIDATES = [
    CUSTOM_REGULAR_ENV,
    "assets/fonts/NotoSans-Regular.ttf",
    "src/server/assets/fonts/NotoSans-Regular.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
];
const BOLD_CANDIDATES = [
    CUSTOM_BOLD_ENV,
    "assets/fonts/NotoSans-Bold.ttf",
    "src/server/assets/fonts/NotoSans-Bold.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
];
const configurePdfFonts = (doc) => {
    const regularPath = firstExistingPath(REGULAR_CANDIDATES);
    const boldPath = firstExistingPath(BOLD_CANDIDATES);
    if (!regularPath) {
        return {
            regular: "Helvetica",
            bold: "Helvetica-Bold",
            supportsUnicode: false,
        };
    }
    doc.registerFont(REGULAR_FONT_NAME, regularPath);
    doc.registerFont(BOLD_FONT_NAME, boldPath || regularPath);
    return {
        regular: REGULAR_FONT_NAME,
        bold: BOLD_FONT_NAME,
        supportsUnicode: true,
    };
};
exports.configurePdfFonts = configurePdfFonts;
