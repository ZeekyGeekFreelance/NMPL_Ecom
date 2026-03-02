import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as TwitterStrategy } from "passport-twitter";
import { Profile } from "passport";
import prisma from "@/infra/database/database.config";
import {
  generateAccessToken,
  generateRefreshToken,
} from "@/shared/utils/auth/tokenUtils";
import { config } from "@/config";

const isConfigured = (...values: Array<string | undefined>): boolean =>
  values.every((value) => typeof value === "string" && value.trim().length > 0);

export default function configurePassport() {
  const googleClientId = config.raw.GOOGLE_CLIENT_ID;
  const googleClientSecret = config.raw.GOOGLE_CLIENT_SECRET;
  const googleCallback = config.isProduction
    ? config.raw.GOOGLE_CALLBACK_URL_PROD
    : config.raw.GOOGLE_CALLBACK_URL_DEV;

  if (isConfigured(googleClientId, googleClientSecret, googleCallback)) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId as string,
          clientSecret: googleClientSecret as string,
          callbackURL: googleCallback as string,
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: Profile,
          done: any
        ) => {
          try {
            let user = await prisma.user.findUnique({
              where: { email: profile.emails![0].value },
            });

            if (user) {
              if (!user.googleId) {
                user = await prisma.user.update({
                  where: { email: profile.emails![0].value },
                  data: {
                    googleId: profile.id,
                    avatar: profile.photos![0]?.value || "",
                  },
                });
              }
            } else {
              user = await prisma.user.create({
                data: {
                  email: profile.emails![0].value,
                  name: profile.displayName,
                  googleId: profile.id,
                  avatar: profile.photos![0]?.value || "",
                },
              });
            }

            const id = user.id;
            return done(null, {
              ...user,
              accessToken: generateAccessToken(id, user.tokenVersion ?? 0),
              refreshToken: generateRefreshToken(
                id,
                undefined,
                user.tokenVersion ?? 0
              ),
            });
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  const facebookAppId = config.raw.FACEBOOK_APP_ID;
  const facebookAppSecret = config.raw.FACEBOOK_APP_SECRET;
  const facebookCallback = config.isProduction
    ? config.raw.FACEBOOK_CALLBACK_URL_PROD
    : config.raw.FACEBOOK_CALLBACK_URL_DEV;

  if (isConfigured(facebookAppId, facebookAppSecret, facebookCallback)) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: facebookAppId as string,
          clientSecret: facebookAppSecret as string,
          callbackURL: facebookCallback as string,
          profileFields: ["id", "emails", "name"],
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: any,
          done: any
        ) => {
          try {
            let user = await prisma.user.findUnique({
              where: { email: profile.emails?.[0]?.value || "" },
            });

            if (user) {
              if (!user.facebookId) {
                user = await prisma.user.update({
                  where: { email: profile.emails?.[0]?.value || "" },
                  data: {
                    facebookId: profile.id,
                    avatar: profile.photos?.[0]?.value || "",
                  },
                });
              }
            } else {
              user = await prisma.user.create({
                data: {
                  email: profile.emails?.[0]?.value || "",
                  name: `${profile.name?.givenName} ${profile.name?.familyName}`,
                  facebookId: profile.id,
                  avatar: profile.photos?.[0]?.value || "",
                },
              });
            }

            const id = user.id;
            return done(null, {
              ...user,
              accessToken: generateAccessToken(id, user.tokenVersion ?? 0),
              refreshToken: generateRefreshToken(
                id,
                undefined,
                user.tokenVersion ?? 0
              ),
            });
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  const twitterConsumerKey = config.raw.TWITTER_CONSUMER_KEY;
  const twitterConsumerSecret = config.raw.TWITTER_CONSUMER_SECRET;
  const twitterCallback = config.isProduction
    ? config.raw.TWITTER_CALLBACK_URL_PROD
    : config.raw.TWITTER_CALLBACK_URL_DEV;

  if (isConfigured(twitterConsumerKey, twitterConsumerSecret, twitterCallback)) {
    passport.use(
      new TwitterStrategy(
        {
          consumerKey: twitterConsumerKey as string,
          consumerSecret: twitterConsumerSecret as string,
          callbackURL: twitterCallback as string,
          includeEmail: true,
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: Profile,
          done: any
        ) => {
          try {
            if (!profile || !profile.id) {
              return done(new Error("Failed to fetch valid Twitter profile"));
            }

            const email =
              profile.emails?.[0]?.value || `twitter-${profile.id}@placeholder.com`;
            const name =
              profile.displayName || profile.username || `Twitter User ${profile.id}`;
            const avatar = profile.photos?.[0]?.value || "";

            let user = await prisma.user.findUnique({
              where: { email },
            });

            if (user) {
              if (!user.twitterId) {
                user = await prisma.user.update({
                  where: { email },
                  data: {
                    twitterId: profile.id,
                    avatar,
                  },
                });
              }
            } else {
              user = await prisma.user.create({
                data: {
                  email,
                  name,
                  twitterId: profile.id,
                  avatar,
                },
              });
            }

            const id = user.id;
            return done(null, {
              ...user,
              accessToken: generateAccessToken(id, user.tokenVersion ?? 0),
              refreshToken: generateRefreshToken(
                id,
                undefined,
                user.tokenVersion ?? 0
              ),
            });
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }
}
