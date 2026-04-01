import { MainLayout } from "@/app/components/layout/MainLayout";
export default function AboutPage() {
  const name = process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "NMPL";
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@nmpl.online";
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">About {name}</h1>
        <p className="text-lg text-gray-600 leading-relaxed mb-6">
          We are a trusted e-commerce platform delivering quality products to customers across India.
          Our mission is to provide a seamless shopping experience with competitive prices and reliable delivery.
        </p>
        <p className="text-gray-600">For support, reach us at <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a></p>
      </div>
    </MainLayout>
  );
}
