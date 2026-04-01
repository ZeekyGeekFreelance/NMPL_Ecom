"use client";
import { useEffect, useMemo, useState } from "react";
import { useGetRestockHistoryQuery } from "@/app/store/apis/VariantApi";
import formatDate from "@/app/utils/formatDate";
import { Search, X } from "lucide-react";
import { getPaginatedSerialNumber } from "@/app/lib/utils/pagination";
import LoadingDots from "@/app/components/feedback/LoadingDots";

interface RestockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  variantId?: string;
  variantSku?: string;
}

const RestockHistoryModal: React.FC<RestockHistoryModalProps> = ({
  isOpen,
  onClose,
  variantId,
  variantSku,
}) => {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      setSearchQuery("");
    }
  }, [isOpen, variantId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const body = document.body;
    const dashboardScrollContainer = document.querySelector(
      '[data-dashboard-scroll-container="true"]'
    ) as HTMLElement | null;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;
    const previousDashboardOverflow = dashboardScrollContainer?.style.overflow;
    const previousDashboardTouchAction =
      dashboardScrollContainer?.style.touchAction;
    const currentCount = Number(body.dataset.modalOpenCount || "0");
    const nextCount = currentCount + 1;

    body.dataset.modalOpenCount = String(nextCount);
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    if (dashboardScrollContainer) {
      dashboardScrollContainer.style.overflow = "hidden";
      dashboardScrollContainer.style.touchAction = "none";
    }

    return () => {
      const latestCount = Number(body.dataset.modalOpenCount || "1");
      const decrementedCount = Math.max(0, latestCount - 1);

      if (decrementedCount === 0) {
        delete body.dataset.modalOpenCount;
        body.style.overflow = previousOverflow;
        body.style.touchAction = previousTouchAction;
        if (dashboardScrollContainer) {
          dashboardScrollContainer.style.overflow = previousDashboardOverflow || "";
          dashboardScrollContainer.style.touchAction =
            previousDashboardTouchAction || "";
        }
        return;
      }

      body.dataset.modalOpenCount = String(decrementedCount);
    };
  }, [isOpen]);

  const { data, isLoading } = useGetRestockHistoryQuery(
    { variantId: variantId || "all", page, limit: 10 },
    { skip: !isOpen }
  );
  const restocks = data?.restocks || [];
  const resolvedTotalResults =
    typeof data?.totalResults === "number" ? data.totalResults : restocks.length;
  const resolvedResultsPerPage =
    typeof data?.resultsPerPage === "number" && data.resultsPerPage > 0
      ? data.resultsPerPage
      : 10;
  const resolvedTotalPages =
    typeof data?.totalPages === "number" && data.totalPages > 0
      ? data.totalPages
      : Math.max(1, Math.ceil(resolvedTotalResults / resolvedResultsPerPage));
  const resolvedCurrentPage =
    typeof data?.currentPage === "number" && data.currentPage > 0
      ? data.currentPage
      : page;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleRestocks = useMemo(() => {
    if (!normalizedSearchQuery) {
      return restocks;
    }

    return restocks.filter((row: any) => {
      const searchBlob = [
        String(row?.variant?.sku ?? ""),
        String(row?.quantity ?? ""),
        String(row?.notes ?? ""),
        String(row?.user?.name ?? ""),
        formatDate(row?.createdAt),
      ]
        .join(" ")
        .toLowerCase();
      return searchBlob.includes(normalizedSearchQuery);
    });
  }, [normalizedSearchQuery, restocks]);
  const hasPreviousPage = resolvedCurrentPage > 1;
  const hasNextPage = resolvedCurrentPage < resolvedTotalPages;
  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > resolvedTotalPages) {
      return;
    }
    setPage(nextPage);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        className="relative flex h-[calc(100dvh-2rem)] min-h-0 w-full max-w-6xl flex-col rounded-xl bg-white p-6 max-h-[calc(100dvh-2rem)]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
          aria-label="Close restock history"
        >
          <X size={18} />
        </button>

        <div className="shrink-0 border-b border-gray-200 pb-4">
          <h2 className="pr-12 text-base font-semibold text-gray-900 sm:text-lg">
            {variantId ? "Variant Restock History" : "All Restock History"}
          </h2>
          {variantId && variantSku ? (
            <p className="mt-1 text-sm text-gray-600">
              SKU: <span className="font-medium text-gray-900">{variantSku}</span>
            </p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col space-y-4 pt-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by SKU, quantity, note, user, or date"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <p className="text-sm text-gray-600">
                Showing {resolvedTotalResults} results (Page {resolvedCurrentPage}),{" "}
                {resolvedResultsPerPage} per page
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 border-b border-gray-200 bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    SN No.
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    SKU
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Quantity
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Notes
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Restocked By
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      <LoadingDots
                        label="Loading restock history"
                        align="center"
                        className="justify-center"
                      />
                    </td>
                  </tr>
                ) : visibleRestocks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No restock history available
                    </td>
                  </tr>
                ) : (
                  visibleRestocks.map((row: any, index: number) => (
                    <tr
                      key={row.id || `${row.createdAt}-${index}`}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="px-4 py-3 text-gray-700">
                        {getPaginatedSerialNumber(
                          index,
                          resolvedCurrentPage,
                          resolvedResultsPerPage
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row?.variant?.sku || variantSku || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {row.quantity ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.notes || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.user?.name || "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatDate(row.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sticky bottom-0 z-20 mt-4 flex items-center justify-between border-t border-gray-200 bg-white pt-4">
          <p className="text-xs text-gray-500">
            Restock log is read-only audit data.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handlePageChange(resolvedCurrentPage - 1)}
              disabled={!hasPreviousPage}
              className="rounded border border-blue-100 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="rounded border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
              {resolvedCurrentPage} / {resolvedTotalPages}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(resolvedCurrentPage + 1)}
              disabled={!hasNextPage}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestockHistoryModal;
