import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/app/components/templates/MainLayout";

const highlights = [
  { value: "1997", label: "Established" },
  { value: "25+", label: "Years in industry" },
  { value: "300+", label: "Connected businesses" },
  { value: "4500+", label: "Catalog variants" },
];

const awards = [
  {
    src: "/images/about/awards/Picture9.png",
    alt: "Certificate of appreciation",
  },
  {
    src: "/images/about/awards/Picture10.jpg",
    alt: "Recognition certificate",
  },
  {
    src: "/images/about/awards/Picture3.png",
    alt: "Award plaque",
  },
  {
    src: "/images/about/awards/Picture4.png",
    alt: "Achievement trophy",
  },
  {
    src: "/images/about/awards/Picture5.png",
    alt: "Award trophy",
  },
  {
    src: "/images/about/awards/Picture6.png",
    alt: "Crystal award",
  },
  {
    src: "/images/about/awards/Picture7.png",
    alt: "Recognition award",
  },
  {
    src: "/images/about/awards/Picture8.png",
    alt: "Honour plaque",
  },
  {
    src: "/images/about/awards/Picture1.png",
    alt: "Certificate",
  },
  {
    src: "/images/about/awards/Picture2.png",
    alt: "Award certificate",
  },
];

const AboutUsPage = () => {
  return (
    <MainLayout>
      <div className="space-y-12 py-10 sm:space-y-14 sm:py-12 lg:space-y-16 lg:py-14">
        <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: "var(--color-secondary)" }}
              >
                About NMPL
              </p>
              <h1 className="type-h1 mt-2 text-slate-900">Company Profile</h1>
              <p className="prose-section mt-5 text-slate-700">
                Needle Marketing Pvt. Ltd. is a private limited company
                established in 1997 in Bangalore, with a long-standing presence
                in industrial sewing products and sewing accessories. Our focus
                is to support garment production units with dependable product
                quality and practical procurement support.
              </p>
              <p className="prose-section mt-4 text-slate-700">
                We have consistently served manufacturers and dealers through
                curated product lines, transparent operations, and committed
                service standards. The brand is built on trust, continuity, and
                a clear intent to deliver long-term value to production teams.
              </p>
            </div>

            <div className="relative">
              <div
                className="absolute inset-x-0 top-8 h-52 rounded-2xl"
                style={{ backgroundColor: "var(--color-primary-light)" }}
              />
              <div className="relative ml-0 mr-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mr-10">
                <div className="relative h-56 w-full sm:h-64 lg:h-72">
                  <Image
                    src="/images/about/shopOutlet.png"
                    alt="Company building"
                    fill
                    unoptimized
                    className="object-cover object-center [transform:scale(1.04)] sm:[transform:scale(1)]"
                    sizes="(max-width: 640px) 88vw, (max-width: 1024px) 100vw, 40vw"
                  />
                </div>
              </div>
              <div className="relative mt-4 ml-auto w-[78%] rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-lg font-semibold text-slate-900">NMPL</p>
                <p className="mt-1 text-sm text-slate-600">
                  Sewing is an art with NMPL&apos;s part.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {highlights.map((item) => (
              <article
                key={item.label}
                className="rounded-xl border border-slate-200 px-4 py-4"
              >
                <p className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                  {item.value}
                </p>
                <p className="mt-1 text-sm text-slate-600">{item.label}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-200">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div
              className="flex items-center px-6 py-10 sm:px-10"
              style={{ backgroundColor: "var(--color-primary-light)" }}
            >
              <h2 className="type-h2 text-slate-900">History</h2>
            </div>
            <div className="bg-white px-6 py-10 sm:px-10">
              <p className="prose-section text-slate-700">
                The company has evolved with the garment industry for decades,
                growing from a regional distributor into a dependable sourcing
                partner for products and spare parts. This journey reflects our
                commitment to understanding production needs and responding with
                practical, reliable solutions.
              </p>
              <p className="prose-section mt-4 text-slate-700">
                With deep category experience, we have strengthened our ability
                to deliver relevant products, operational consistency, and
                service reliability to manufacturing ecosystems at scale.
              </p>
            </div>
          </div>
        </section>

        <section
          className="overflow-hidden rounded-[24px] px-5 py-5 sm:px-6 sm:py-6"
          style={{ backgroundColor: "var(--color-primary-light)" }}
        >
          <div className="grid items-stretch gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-2xl rounded-b-none bg-white p-6 sm:p-8 lg:rounded-b-2xl lg:rounded-r-none">
              <h2 className="type-h2 text-slate-900">Core Values</h2>
              <div className="mt-5 space-y-5">
                <div>
                  <h3 className="type-h4 text-slate-900">Vision</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
                    Deliver reliable products and services that help customers
                    enrich their operations.
                  </p>
                </div>
                <div>
                  <h3 className="type-h4 text-slate-900">Mission</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
                    Continuously improve quality, service responsiveness, and
                    procurement confidence across every customer journey.
                  </p>
                </div>
              </div>
            </div>
            <div className="relative min-h-[260px] overflow-hidden rounded-2xl rounded-t-none lg:rounded-t-2xl lg:rounded-l-none">
              <Image
                src="/images/about/needleZoomed.jpg"
                alt="Needle and thread"
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white px-6 py-8 sm:px-10 sm:py-10">
          <h2 className="type-h2 text-slate-900">Awards and Recognitions</h2>
          <p className="prose-section mt-4 max-w-4xl text-slate-700">
            NMPL has maintained strong quality and service standards over the
            years, reflected in recognitions from industry partners and
            associated institutions. These milestones reinforce our commitment
            to performance, reliability, and long-term partnership.
          </p>

          <div className="mt-8 columns-2 gap-4 sm:columns-3 lg:columns-4">
            {awards.map((award, index) => (
              <div key={`award-${index + 1}`} className="mb-4 break-inside-avoid">
                <Image
                  src={award.src}
                  alt={award.alt}
                  width={640}
                  height={480}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="h-auto w-full rounded-md border border-slate-200 bg-white shadow-sm"
                />
              </div>
            ))}
          </div>
        </section>

        <section
          className="rounded-[24px] px-6 py-8 sm:px-10 sm:py-10"
          style={{ backgroundColor: "var(--color-primary-light)" }}
        >
          <h2 className="type-h2 text-slate-900">Location</h2>
          <p className="mt-3 text-sm text-slate-700 sm:text-base">
            428, 9th Main Road, 3rd Phase, Peenya, Bangalore.
          </p>
          <Link
            href="https://maps.google.com/?q=Peenya+Bangalore"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary mt-5 !h-10 !px-4"
          >
            View Map
          </Link>
        </section>
      </div>
    </MainLayout>
  );
};

export default AboutUsPage;
