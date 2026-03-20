-- Remove OAuth fields from User table
ALTER TABLE "User" DROP COLUMN IF EXISTS "googleId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "twitterId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "facebookId";