import Image from "next/image";
import MainLayout from "@/app/components/templates/MainLayout";

const brandStory = [
  "Dot\u2122 is an NMPL brand developed for precision sewing requirements in everyday production workflows.",
  "The range focuses on practical accessories and consumables that tailors, garment units, and resellers can reorder with confidence.",
  "Our objective is simple: consistent availability, dependable quality, and a product line aligned with real factory and retail use cases.",
];

const featureShots = [
  {
    src: "/images/products/needle_horizontal.png",
    alt: "Dot product preview - needle card",
  },
  {
    src: "/images/products/typical_machine.jpeg",
    alt: "Dot product preview - industrial machine setup",
  },
  {
    src: "/images/products/macro-sewing-machine-tool.jpeg",
    alt: "Dot product preview - accessories",
  },
];

const DotTmPage = () => {
  return (
    <MainLayout>
      <div className="space-y-8 py-8 sm:space-y-10 sm:py-10 lg:space-y-12 lg:py-12">
        <section className="relative overflow-hidden rounded-[28px] bg-[#a8b8ea] px-4 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-14">
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="relative mx-auto aspect-[16/9] w-full max-w-[620px]">
              <Image
                src="/images/branding/partners/cards/Dot_Logo.jpg"
                alt="Dot\u2122 logo"
                fill
                priority
                quality={100}
                className="object-contain"
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 80vw, 620px"
              />
            </div>
            <div className="mx-auto mt-4 max-w-[280px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500">
                A BRAND OF
              </p>
              <div className="relative mx-auto mt-1 h-9 w-36 sm:h-10 sm:w-40">
                <Image
                  src="/images/branding/logo.jpg"
                  alt="NMPL logo"
                  fill
                  className="object-contain"
                  sizes="160px"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="flex min-h-[220px] items-center justify-center rounded-[24px] bg-[#a8b8ea] px-6 py-8">
            <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
              Dot<sup className="ml-0.5 align-super text-[0.38em]">TM</sup>
            </h1>
          </article>

          <article className="rounded-[24px] border border-slate-200 bg-white px-6 py-6 sm:px-8 sm:py-8">
            <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Dot<sup className="ml-0.5 align-super text-[0.4em]">TM</sup> by NMPL
            </h2>
            <div className="prose-section mt-4 space-y-3 text-slate-700">
              {brandStory.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[24px] bg-[#a8b8ea] p-4 sm:p-5">
            <div className="space-y-4">
              {featureShots.map((shot) => (
                <div
                  key={`left-${shot.src}`}
                  className="relative overflow-hidden rounded-xl bg-white/70"
                >
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={shot.src}
                      alt={shot.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 28vw"
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              {featureShots.map((shot) => (
                <article
                  key={`top-${shot.src}`}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={shot.src}
                      alt={shot.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 30vw"
                    />
                  </div>
                </article>
              ))}
            </div>

            <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
              <div className="relative mx-auto aspect-[16/7] w-full max-w-2xl">
                <Image
                  src="/images/branding/partners/cards/Dot_Logo.jpg"
                  alt="Dot brand card"
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 48vw"
                />
              </div>
            </article>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default DotTmPage;
