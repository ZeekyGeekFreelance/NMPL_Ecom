"use client";
import Footer from "../layout/Footer";
import Navbar from "../layout/Navbar";

export default function MainLayout({
  children,
  showFooter = true,
}: {
  children: React.ReactNode;
  showFooter?: boolean;
}) {
  return (
    <main
      className={`flex w-full flex-col ${
        showFooter ? "min-h-screen" : "h-dvh overflow-hidden"
      }`}
    >
      <Navbar />
      <div
        className={`w-full px-4 sm:px-6 lg:px-8 xl:max-w-7xl xl:mx-auto ${
          showFooter ? "" : "flex-1 min-h-0"
        }`}
      >
        {children}
      </div>
      {showFooter && <Footer />}
    </main>
  );
}
