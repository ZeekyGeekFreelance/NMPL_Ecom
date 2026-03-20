import passport from "passport";
import prisma from "@/infra/database/database.config";

export default function configurePassport() {
  // Serialize user ID into session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          phone: true,
          tokenVersion: true,
        },
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}
