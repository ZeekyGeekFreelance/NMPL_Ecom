import { fetchServerProductBySlug } from "@/app/lib/serverProductQueries";
import ProductDetailsClient from "./ProductDetailsClient";

interface ProductPageProps {
  params: Promise<{ slug?: string | string[] }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const resolvedParams = await params;
  const rawSlug = resolvedParams?.slug;
  const slug =
    typeof rawSlug === "string" ? rawSlug : (rawSlug?.[0] ?? "").trim();
  const initialProduct = slug ? await fetchServerProductBySlug(slug) : null;

  return <ProductDetailsClient slug={slug} initialProduct={initialProduct} />;
}
