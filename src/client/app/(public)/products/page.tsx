import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MainLayout from "@/app/components/templates/MainLayout";

const productStats = [
  { value: "4500+", label: "Product varieties" },
  { value: "300+", label: "Active buyers" },
  { value: "25+", label: "Industry brands" },
];

const showcaseProducts = [
  {
    title: "Sewing Machine Needles",
    summary:
      "Precision-made needle range for woven, knit, and technical garment workflows.",
    image: "/images/products/needle_horizontal.png",
    imagePosition: "99.8% 54%",
    href: "/shop?search=needles",
  },
  {
    title: "Sewing Machines",
    summary:
      "Industrial machines curated for stable throughput and dependable finishing quality.",
    image: "/images/products/typical_machine.jpeg",
    imagePosition: "38% 48%",
    href: "/shop?search=machine",
  },
  {
    title: "Spare Parts",
    summary:
      "Critical replacement parts and accessories to keep production lines uninterrupted.",
    image: "/images/products/macro-sewing-machine-tool.jpeg",
    imagePosition: "52% 48%",
    href: "/shop?search=parts",
  },
];

const audienceCards = [
  {
    title: "Customers",
    text: "Find dependable products with clear pricing and a streamlined purchase flow.",
    cta: "Shop Products",
    href: "/shop",
  },
  {
    title: "Dealers",
    text: "Access dealer onboarding and structured B2B operations for repeat procurement.",
    cta: "Become a Dealer",
    href: "/dealer/register",
  },
];

const productStories = [
  {
    title: "Sewing Machine Needles",
    body: "Our needle program is selected for consistent penetration, reduced breakage, and cleaner stitch lines at production speed. It supports high-volume garment units that require repeatable quality across diverse fabric types.",
    image: "/images/products/needle_horizontal.png",
    imagePosition: "52% 48%",
    imageScale: 1.00,
    tone: "light",
  },
  {
    title: "Sewing Machines",
    body: "From core stitching operations to specialized finishing lines, our machine selection balances performance with maintainability. We focus on uptime, operator comfort, and dependable output for daily industrial usage.",
    image: "/images/products/typical_machine.jpeg",
    imagePosition: "54% 50%",
    imageScale: 1.00,
    tone: "primary",
  },
  {
    title: "Spare Parts and Accessories",
    body: "We maintain an organized inventory of wear parts and essential accessories so maintenance teams can respond quickly. The objective is simple: reduce downtime and keep production planning predictable.",
    image: "/images/products/macro-sewing-machine-tool.jpeg",
    imagePosition: "50% 65%",
    imageScale: 1.00,
    tone: "light",
  },
];

const ProductsShowcasePage = () => {
  return (
    <MainLayout>
      <div className="space-y-12 py-10 sm:space-y-14 sm:py-12 lg:space-y-16 lg:py-14">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="px-6 py-8 sm:px-10 sm:py-10">
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--color-secondary)" }}
              >
                Product Portfolio
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                Our Products
              </h1>
              <p className="prose-section mt-4 max-w-3xl text-slate-600">
                NMPL offers a focused catalog for garment production teams,
                covering precision needles, industrial machines, and critical
                spare parts. Every product line is selected for reliability,
                consistency, and long-term operational value.
              </p>
            </div>
            <div
              className="px-6 py-8 sm:px-10 sm:py-10"
              style={{ backgroundColor: "var(--color-primary-light)" }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {productStats.map((stat) => (
                  <article
                    key={stat.label}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-4"
                  >
                    <p className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 pb-8 sm:px-10 sm:pb-10">
            <div className="h-px w-full bg-slate-200" />
          </div>

          <div className="px-6 pb-8 sm:px-10 sm:pb-10">
            <div className="grid gap-5 md:grid-cols-3">
            {showcaseProducts.map((product) => (
              <article
                key={product.title}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow duration-300 hover:shadow-md"
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    unoptimized
                    className="object-cover"
                    style={{ objectPosition: product.imagePosition }}
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="p-5">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {product.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">{product.summary}</p>
                  <Link
                    href={product.href}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium transition-transform duration-200 group-hover:translate-x-0.5"
                    style={{ color: "var(--color-primary)" }}
                  >
                    Explore
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white px-6 py-8 sm:px-8 sm:py-10">
          <h2 className="type-h2 text-center text-slate-900">
            Choose What Best Suits You
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-base text-slate-600 sm:text-lg">
            We are open for both customers and dealers.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {audienceCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-slate-200 px-6 py-6"
                style={{ backgroundColor: "var(--color-primary-light)" }}
              >
                <h3 className="type-h4 text-slate-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
                  {card.text}
                </p>
                <Link href={card.href} className="btn-secondary mt-5 !h-10 !px-4">
                  {card.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          {productStories.map((section, index) => (
            <article
              key={section.title}
              className={`overflow-hidden rounded-[24px] border ${
                section.tone === "primary"
                  ? "border-transparent text-slate-900"
                  : "border-slate-200 bg-white"
              }`}
              style={
                section.tone === "primary"
                  ? { backgroundColor: "var(--color-primary-light)" }
                  : undefined
              }
            >
              <div className="grid items-center gap-0 md:grid-cols-2">
                <div
                  className={`p-6 sm:p-8 lg:p-10 ${
                    index % 2 !== 0 ? "md:order-2" : ""
                  }`}
                >
                  <h3 className="text-3xl font-semibold leading-tight text-slate-900">
                    {section.title}
                  </h3>
                  <p className="prose-section mt-4 text-slate-700">
                    {section.body}
                  </p>
                </div>
                <div
                  className={`relative h-64 w-full md:h-full md:min-h-[280px] ${
                    index % 2 !== 0 ? "md:order-1" : ""
                  }`}
                >
                  <Image
                    src={section.image}
                    alt={section.title}
                    fill
                    unoptimized
                    className="object-cover"
                    style={{
                      objectPosition: section.imagePosition,
                      transform: `scale(${section.imageScale})`,
                      transformOrigin: section.imagePosition,
                    }}
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </div>
            </article>
          ))}
        </section>

        <section
          className="rounded-[24px] px-6 py-8 text-center sm:px-10 sm:py-10"
          style={{ backgroundColor: "var(--color-primary-light)" }}
        >
          <p className="mx-auto max-w-3xl text-3xl leading-tight text-slate-900 sm:text-4xl">
            We are ready to support your production journey with dependable
            products and responsive service.
          </p>
        </section>
      </div>
    </MainLayout>
  );
};

export default ProductsShowcasePage;
