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
exports.default = configurePassport;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_facebook_1 = require("passport-facebook");
const passport_twitter_1 = require("passport-twitter");
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const tokenUtils_1 = require("@/shared/utils/auth/tokenUtils");
const config_1 = require("@/config");
const isConfigured = (...values) => values.every((value) => typeof value === "string" && value.trim().length > 0);
function configurePassport() {
    const googleClientId = config_1.config.raw.GOOGLE_CLIENT_ID;
    const googleClientSecret = config_1.config.raw.GOOGLE_CLIENT_SECRET;
    const googleCallback = config_1.config.isProduction
        ? config_1.config.raw.GOOGLE_CALLBACK_URL_PROD
        : config_1.config.raw.GOOGLE_CALLBACK_URL_DEV;
    if (isConfigured(googleClientId, googleClientSecret, googleCallback)) {
        passport_1.default.use(new passport_google_oauth20_1.Strategy({
            clientID: googleClientId,
            clientSecret: googleClientSecret,
            callbackURL: googleCallback,
        }, (_accessToken, _refreshToken, profile, done) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                let user = yield database_config_1.default.user.findUnique({
                    where: { email: profile.emails[0].value },
                });
                if (user) {
                    if (!user.googleId) {
                        user = yield database_config_1.default.user.update({
                            where: { email: profile.emails[0].value },
                            data: {
                                googleId: profile.id,
                                avatar: ((_a = profile.photos[0]) === null || _a === void 0 ? void 0 : _a.value) || "",
                            },
                        });
                    }
                }
                else {
                    user = yield database_config_1.default.user.create({
                        data: {
                            email: profile.emails[0].value,
                            name: profile.displayName,
                            googleId: profile.id,
                            avatar: ((_b = profile.photos[0]) === null || _b === void 0 ? void 0 : _b.value) || "",
                        },
                    });
                }
                const id = user.id;
                return done(null, Object.assign(Object.assign({}, user), { accessToken: (0, tokenUtils_1.generateAccessToken)(id), refreshToken: (0, tokenUtils_1.generateRefreshToken)(id) }));
            }
            catch (error) {
                return done(error);
            }
        })));
    }
    const facebookAppId = config_1.config.raw.FACEBOOK_APP_ID;
    const facebookAppSecret = config_1.config.raw.FACEBOOK_APP_SECRET;
    const facebookCallback = config_1.config.isProduction
        ? config_1.config.raw.FACEBOOK_CALLBACK_URL_PROD
        : config_1.config.raw.FACEBOOK_CALLBACK_URL_DEV;
    if (isConfigured(facebookAppId, facebookAppSecret, facebookCallback)) {
        passport_1.default.use(new passport_facebook_1.Strategy({
            clientID: facebookAppId,
            clientSecret: facebookAppSecret,
            callbackURL: facebookCallback,
            profileFields: ["id", "emails", "name"],
        }, (_accessToken, _refreshToken, profile, done) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            try {
                let user = yield database_config_1.default.user.findUnique({
                    where: { email: ((_b = (_a = profile.emails) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value) || "" },
                });
                if (user) {
                    if (!user.facebookId) {
                        user = yield database_config_1.default.user.update({
                            where: { email: ((_d = (_c = profile.emails) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value) || "" },
                            data: {
                                facebookId: profile.id,
                                avatar: ((_f = (_e = profile.photos) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.value) || "",
                            },
                        });
                    }
                }
                else {
                    user = yield database_config_1.default.user.create({
                        data: {
                            email: ((_h = (_g = profile.emails) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.value) || "",
                            name: `${(_j = profile.name) === null || _j === void 0 ? void 0 : _j.givenName} ${(_k = profile.name) === null || _k === void 0 ? void 0 : _k.familyName}`,
                            facebookId: profile.id,
                            avatar: ((_m = (_l = profile.photos) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.value) || "",
                        },
                    });
                }
                const id = user.id;
                return done(null, Object.assign(Object.assign({}, user), { accessToken: (0, tokenUtils_1.generateAccessToken)(id), refreshToken: (0, tokenUtils_1.generateRefreshToken)(id) }));
            }
            catch (error) {
                return done(error);
            }
        })));
    }
    const twitterConsumerKey = config_1.config.raw.TWITTER_CONSUMER_KEY;
    const twitterConsumerSecret = config_1.config.raw.TWITTER_CONSUMER_SECRET;
    const twitterCallback = config_1.config.isProduction
        ? config_1.config.raw.TWITTER_CALLBACK_URL_PROD
        : config_1.config.raw.TWITTER_CALLBACK_URL_DEV;
    if (isConfigured(twitterConsumerKey, twitterConsumerSecret, twitterCallback)) {
        passport_1.default.use(new passport_twitter_1.Strategy({
            consumerKey: twitterConsumerKey,
            consumerSecret: twitterConsumerSecret,
            callbackURL: twitterCallback,
            includeEmail: true,
        }, (_accessToken, _refreshToken, profile, done) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                if (!profile || !profile.id) {
                    return done(new Error("Failed to fetch valid Twitter profile"));
                }
                const email = ((_b = (_a = profile.emails) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value) || `twitter-${profile.id}@placeholder.com`;
                const name = profile.displayName || profile.username || `Twitter User ${profile.id}`;
                const avatar = ((_d = (_c = profile.photos) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value) || "";
                let user = yield database_config_1.default.user.findUnique({
                    where: { email },
                });
                if (user) {
                    if (!user.twitterId) {
                        user = yield database_config_1.default.user.update({
                            where: { email },
                            data: {
                                twitterId: profile.id,
                                avatar,
                            },
                        });
                    }
                }
                else {
                    user = yield database_config_1.default.user.create({
                        data: {
                            email,
                            name,
                            twitterId: profile.id,
                            avatar,
                        },
                    });
                }
                const id = user.id;
                return done(null, Object.assign(Object.assign({}, user), { accessToken: (0, tokenUtils_1.generateAccessToken)(id), refreshToken: (0, tokenUtils_1.generateRefreshToken)(id) }));
            }
            catch (error) {
                return done(error);
            }
        })));
    }
}
