import Image from "next/image";
import MainLayout from "@/app/components/templates/MainLayout";
import GucciLogo from "@/app/assets/images/gucci.png";
import KgKraftLogo from "@/app/assets/images/kgKraftLogo.png";

const brands = [
  {
    name: "KG Kraft",
    logo: KgKraftLogo,
    summary: "Core in-house brand for dependable daily essentials.",
  },
  {
    name: "Gucci",
    logo: GucciLogo,
    summary: "Premium global label featured in lifestyle selections.",
  },
  {
    name: "NM Select",
    logo: null,
    summary: "Curated assortment for high-demand commerce categories.",
  },
  {
    name: "Needle Works",
    logo: null,
    summary: "Quality-focused line for professional and utility goods.",
  },
];

const BrandsShowcasePage = () => {
  return (
    <MainLayout>
      <section className="py-10 sm:py-14">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Brands Showcase
          </h1>
          <p className="mt-3 text-gray-600">
            Partner and in-house brands presented for quick discovery.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {brands.map((brand) => (
            <article
              key={brand.name}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                  {brand.logo ? (
                    <Image
                      src={brand.logo}
                      alt={`${brand.name} logo`}
                      fill
                      className="object-contain p-2"
                      sizes="56px"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-gray-500">
                      {brand.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{brand.name}</h2>
              </div>
              <p className="mt-3 text-sm text-gray-600">{brand.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </MainLayout>
  );
};

export default BrandsShowcasePage;
