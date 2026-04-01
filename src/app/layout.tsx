import "./globals.css";
import ClientProviders from "./ClientProviders";
import { PLATFORM_NAME } from "@/app/lib/constants/config";

export const metadata = {
  title: PLATFORM_NAME,
  description: `${PLATFORM_NAME} storefront`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
