import { MainLayout } from "@/app/components/layout/MainLayout";
import Link from "next/link";

export default function AttributesPage() {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Attributes</h1>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Attributes management — coming soon
        </div>
      </div>
    </MainLayout>
  );
}
