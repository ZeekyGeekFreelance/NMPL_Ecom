import { notFound } from "next/navigation";
import { MainLayout } from "@/app/components/layout/MainLayout";
import prisma from "@/lib/db";
import { ProductDetail } from "./ProductDetail";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({ where: { slug, isDeleted: false }, select: { name: true, description: true } });
  return product ? { title: product.name, description: product.description ?? undefined } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, isDeleted: false },
    include: {
      variants: {
        include: {
          attributes: {
            include: {
              attribute: { select: { name: true } },
              value: { select: { value: true } },
            },
          },
        },
      },
      category: true,
      gst: true,
    },
  });

  if (!product) return notFound();

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ProductDetail product={product} />
      </div>
    </MainLayout>
  );
}
