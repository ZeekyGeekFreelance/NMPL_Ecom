"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CircleAlert, User } from "lucide-react";
import BreadCrumb from "@/app/components/feedback/BreadCrumb";
import Sidebar from "../../components/layout/Sidebar";
import DashboardSearchBar from "@/app/components/molecules/DashboardSearchbar";
import UserMenu from "@/app/components/molecules/UserMenu";
import { useAuth } from "@/app/hooks/useAuth";
import useClickOutside from "@/app/hooks/dom/useClickOutside";
import { useGetDealersQuery } from "@/app/store/apis/UserApi";
import { useGetAllTransactionsQuery } from "@/app/store/apis/TransactionApi";
import { normalizeOrderStatus } from "@/app/lib/orderLifecycle";

type ActionMessage = {
  id: string;
  title: string;
  description: string;
  href: string;
  count: number;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    user,
    isLoading: isAuthLoading,
    isAuthenticated,
  } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [messageCenterOpen, setMessageCenterOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const messageCenterRef = useRef<HTMLDivElement>(null);

  const isDashboardUser =
    user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const { data: pendingDealersData } = useGetDealersQuery(
    { status: "PENDING" },
    {
      skip: !isDashboardUser,
      pollingInterval: 15000,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  const { data: transactionsData } = useGetAllTransactionsQuery(undefined, {
    skip: !isDashboardUser,
    pollingInterval: 15000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const pendingDealerCount = pendingDealersData?.dealers?.length || 0;
  const transactionStatuses = useMemo(
    () =>
      ((transactionsData?.transactions || []) as Array<{ status?: string }>).map(
        (transaction) =>
          normalizeOrderStatus(transaction.status || "PENDING_VERIFICATION")
      ),
    [transactionsData?.transactions]
  );

  const pendingVerificationCount = useMemo(
    () =>
      transactionStatuses.filter((status) => status === "PENDING_VERIFICATION")
        .length,
    [transactionStatuses]
  );

  const paymentFollowupCount = useMemo(
    () =>
      transactionStatuses.filter(
        (status) =>
          status === "AWAITING_PAYMENT" || status === "WAITLISTED"
      ).length,
    [transactionStatuses]
  );

  const actionableTransactionCount =
    pendingVerificationCount + paymentFollowupCount;

  const actionMessages: ActionMessage[] = useMemo(() => {
    const messages: ActionMessage[] = [];

    if (pendingDealerCount > 0) {
      messages.push({
        id: "dealer-enquiries",
        title: "New dealer enquiries",
        description: `${pendingDealerCount} dealer request${
          pendingDealerCount > 1 ? "s are" : " is"
        } pending evaluation.`,
        href: "/dashboard/dealers",
        count: pendingDealerCount,
      });
    }

    if (pendingVerificationCount > 0) {
      messages.push({
        id: "order-verifications",
        title: "Orders need verification",
        description: `${pendingVerificationCount} order${
          pendingVerificationCount > 1 ? "s are" : " is"
        } waiting for stock verification.`,
        href: "/dashboard/transactions",
        count: pendingVerificationCount,
      });
    }

    if (paymentFollowupCount > 0) {
      messages.push({
        id: "payment-followup",
        title: "Quotation follow-up pending",
        description: `${paymentFollowupCount} order${
          paymentFollowupCount > 1 ? "s require" : " requires"
        } payment/waitlist follow-up.`,
        href: "/dashboard/transactions",
        count: paymentFollowupCount,
      });
    }

    return messages;
  }, [pendingDealerCount, pendingVerificationCount, paymentFollowupCount]);

  const totalActionableMessages = actionMessages.reduce(
    (sum, message) => sum + message.count,
    0
  );

  const sidebarNotifications = useMemo(
    () => ({
      dealers: pendingDealerCount,
      transactions: actionableTransactionCount,
    }),
    [pendingDealerCount, actionableTransactionCount]
  );

  useClickOutside(menuRef, () => setMenuOpen(false));
  useClickOutside(messageCenterRef, () => setMessageCenterOpen(false));

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || !isDashboardUser)) {
      router.replace("/sign-in");
    }
  }, [isAuthenticated, isDashboardUser, isAuthLoading, router]);

  if (isAuthLoading || !isAuthenticated || !isDashboardUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar notifications={sidebarNotifications} />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
          <BreadCrumb />
          <div className="flex items-center gap-3 sm:gap-4">
            <DashboardSearchBar />

            <div className="relative" ref={messageCenterRef}>
              <button
                onClick={() => setMessageCenterOpen((prev) => !prev)}
                className="relative inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                aria-label="Open message log center"
              >
                <Bell className="h-4 w-4" />
                <span className="hidden xl:inline">Message Log</span>
                {totalActionableMessages > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                    {totalActionableMessages > 99
                      ? "99+"
                      : totalActionableMessages}
                  </span>
                )}
              </button>

              {messageCenterOpen && (
                <div className="absolute right-0 mt-2 w-[20rem] sm:w-[24rem] rounded-xl border border-gray-200 bg-white shadow-xl z-50">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Actionable Message Log
                      </p>
                      <p className="text-xs text-gray-500">
                        Track operational tasks that need action
                      </p>
                    </div>
                    <CircleAlert className="h-4 w-4 text-amber-500" />
                  </div>

                  <div className="max-h-80 overflow-y-auto p-2">
                    {actionMessages.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center">
                        <p className="text-sm font-medium text-gray-700">
                          No new actionable messages
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          You are currently up to date.
                        </p>
                      </div>
                    ) : (
                      actionMessages.map((message) => (
                        <Link
                          key={message.id}
                          href={message.href}
                          onClick={() => setMessageCenterOpen(false)}
                          className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-gray-50"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {message.title}
                            </p>
                            <p className="text-xs text-gray-600">
                              {message.description}
                            </p>
                          </div>
                          <span className="mt-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                            {message.count}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full hover:bg-gray-100 p-1"
                aria-label="Toggle user menu"
              >
                <div className="relative w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
                  {isAuthLoading ? (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  ) : user?.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.name || "User"}
                      fill
                      sizes="36px"
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                {user?.name && (
                  <span className="text-sm font-medium text-gray-800 hidden sm:inline">
                    {user.name}
                  </span>
                )}
              </button>

              {menuOpen && (
                <UserMenu
                  user={user}
                  menuOpen={menuOpen}
                  closeMenu={() => setMenuOpen(false)}
                />
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
