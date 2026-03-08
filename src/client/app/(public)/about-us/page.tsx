import MainLayout from "@/app/components/templates/MainLayout";

const AboutUsPage = () => {
  return (
    <MainLayout>
      <section className="mx-auto max-w-4xl py-10 sm:py-14">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            NMPL
          </p>
          <h1 className="mt-3 type-h1 text-gray-900">
            About Us
          </h1>
          <p className="mt-6 prose-section text-gray-700">
            Needle Market Private Limited (NMPL) is building a dependable
            commerce platform for practical buying decisions. We focus on a
            clear catalog, transparent pricing, and operational reliability so
            teams and customers can place orders with confidence.
          </p>
          <p className="mt-4 prose-section text-gray-700">
            Our positioning is simple: quality-first product curation,
            confirmation-driven fulfillment, and consistent support. Every
            storefront update is designed to keep buyer trust, dealer growth,
            and long-term business continuity aligned.
          </p>
        </div>
      </section>
    </MainLayout>
  );
};

export default AboutUsPage;
