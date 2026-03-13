import { Poppins } from "next/font/google";
import "./globals.css";
import ClientProviders from "./ClientProviders";
import { PLATFORM_NAME } from "@/app/lib/constants/config";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

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
      <body className={`${poppins.variable} antialiased`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
