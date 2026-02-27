import Image from "next/image";
import MainLayout from "@/app/components/templates/MainLayout";
import MonitorImage from "@/app/assets/images/products/monitor.jpg";
import MacbookImage from "@/app/assets/images/products/macbook.jpg";
import IphoneImage from "@/app/assets/images/products/iphone.jpg";
import HeadphonesImage from "@/app/assets/images/products/headphones.jpg";
import ShoesImage from "@/app/assets/images/products/white-shoes.jpg";
import PythonBookImage from "@/app/assets/images/products/python-book.jpg";

const featuredProducts = [
  {
    name: "Ultra-Wide Monitor",
    category: "Display",
    image: MonitorImage,
    highlight: "High-clarity panel for focused daily work.",
  },
  {
    name: "Performance Laptop",
    category: "Computing",
    image: MacbookImage,
    highlight: "Balanced power profile for business and creation.",
  },
  {
    name: "Smartphone Pro",
    category: "Mobile",
    image: IphoneImage,
    highlight: "Reliable all-day use with premium build quality.",
  },
  {
    name: "Studio Headphones",
    category: "Audio",
    image: HeadphonesImage,
    highlight: "Clean sound signature for calls and media.",
  },
  {
    name: "Classic Sneakers",
    category: "Lifestyle",
    image: ShoesImage,
    highlight: "Comfort-focused design for frequent use.",
  },
  {
    name: "Python Handbook",
    category: "Books",
    image: PythonBookImage,
    highlight: "Practical reference for everyday development work.",
  },
];

const ProductsShowcasePage = () => {
  return (
    <MainLayout>
      <section className="py-10 sm:py-14">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Products Showcase
          </h1>
          <p className="mt-3 text-gray-600">
            Curated highlights from our catalog for quick presentation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredProducts.map((product) => (
            <article
              key={product.name}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="relative h-48 w-full bg-gray-100">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  {product.category}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-gray-900">
                  {product.name}
                </h2>
                <p className="mt-2 text-sm text-gray-600">{product.highlight}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </MainLayout>
  );
};

export default ProductsShowcasePage;
