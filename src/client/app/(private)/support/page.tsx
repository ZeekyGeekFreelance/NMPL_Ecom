"use client";
import Link from "next/link";
import MainLayout from "@/app/components/templates/MainLayout";
import { withAuth } from "@/app/components/HOC/WithAuth";
import { SUPPORT_EMAIL } from "@/app/lib/constants/config";

const SupportPage = () => {
  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Support
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-gray-900 md:text-3xl">
            Direct in-app support is no longer available.
          </h1>
          <p className="mt-4 text-sm leading-7 text-gray-600 md:text-base">
            For help with orders, payments, account access, or dealer questions,
            contact our support team by email. Include your account or order
            reference when possible so the team can help faster.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Email support
            </a>
            <Link
              href="/profile"
              className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Open profile
            </Link>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            Support email:{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-indigo-700 hover:text-indigo-800"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </MainLayout>
  );
};

export default withAuth(SupportPage);
