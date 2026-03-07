"use client";

import { useMemo, useState } from "react";
import { Loader2, MapPinned, Save, Search, Trash2 } from "lucide-react";
import { withAuth } from "@/app/components/HOC/WithAuth";
import PermissionGuard from "@/app/components/auth/PermissionGuard";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import useToast from "@/app/hooks/ui/useToast";
import { ADDRESS_STATE_OPTIONS } from "@/app/lib/validators/address";
import {
  useDeleteStateDeliveryRateMutation,
  useGetStateDeliveryRatesQuery,
  useUpsertStateDeliveryRateMutation,
  type StateDeliveryRate,
} from "@/app/store/apis/DeliveryRateApi";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";

type DraftRate = {
  charge: string;
  isServiceable: boolean;
};

const DeliveryFeesDashboard = () => {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftRate>>({});
  const [savingState, setSavingState] = useState<string | null>(null);
  const [deletingState, setDeletingState] = useState<string | null>(null);
  const [statePendingClear, setStatePendingClear] = useState<string | null>(null);

  const { data, isLoading } = useGetStateDeliveryRatesQuery();
  const [upsertStateDeliveryRate] = useUpsertStateDeliveryRateMutation();
  const [deleteStateDeliveryRate] = useDeleteStateDeliveryRateMutation();

  const rates = data?.rates || [];
  const ratesByState = useMemo(() => {
    return new Map(rates.map((rate) => [rate.state, rate] as const));
  }, [rates]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredStates = useMemo(() => {
    if (!normalizedSearch) {
      return ADDRESS_STATE_OPTIONS;
    }

    return ADDRESS_STATE_OPTIONS.filter((state) =>
      state.toLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch]);

  const getCurrentRowValue = (state: string): DraftRate => {
    const draft = drafts[state];
    if (draft) {
      return draft;
    }

    const existing = ratesByState.get(state);
    return {
      charge: existing ? String(existing.charge) : "",
      isServiceable: existing ? existing.isServiceable : true,
    };
  };

  const isRowDirty = (state: string): boolean => {
    const current = getCurrentRowValue(state);
    const existing = ratesByState.get(state);

    const existingCharge = existing ? String(existing.charge) : "";
    const existingServiceable = existing ? existing.isServiceable : true;

    return (
      current.charge.trim() !== existingCharge ||
      current.isServiceable !== existingServiceable
    );
  };

  const handleDraftChange = (state: string, patch: Partial<DraftRate>) => {
    const current = getCurrentRowValue(state);
    setDrafts((previous) => ({
      ...previous,
      [state]: {
        ...current,
        ...patch,
      },
    }));
  };

  const handleSaveRow = async (state: string) => {
    const current = getCurrentRowValue(state);
    const normalizedCharge = current.charge.trim();

    if (!normalizedCharge) {
      showToast("Enter a delivery fee before saving.", "error");
      return;
    }

    const parsedCharge = Number(normalizedCharge);
    if (!Number.isFinite(parsedCharge) || parsedCharge < 0) {
      showToast("Delivery fee must be a number greater than or equal to 0.", "error");
      return;
    }

    try {
      setSavingState(state);
      await upsertStateDeliveryRate({
        state,
        charge: Number(parsedCharge.toFixed(2)),
        isServiceable: current.isServiceable,
      }).unwrap();
      showToast(`Saved delivery fee for ${state}.`, "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to save state delivery fee."), "error");
    } finally {
      setSavingState(null);
    }
  };

  const handleClearRow = (state: string) => {
    const existing = ratesByState.get(state);
    if (!existing) {
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[state];
        return next;
      });
      return;
    }

    setStatePendingClear(state);
  };

  const confirmClearRow = async () => {
    if (!statePendingClear) {
      return;
    }

    try {
      setDeletingState(statePendingClear);
      await deleteStateDeliveryRate({ state: statePendingClear }).unwrap();
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[statePendingClear];
        return next;
      });
      showToast(`Removed state delivery mapping for ${statePendingClear}.`, "success");
      setStatePendingClear(null);
    } catch (error) {
      showToast(
        getApiErrorMessage(error, "Failed to remove state delivery mapping."),
        "error"
      );
    } finally {
      setDeletingState(null);
    }
  };

  const mappedCount = rates.length;

  return (
    <PermissionGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">State Delivery Fees</h1>
            <p className="mt-1 text-sm text-gray-600">
              Configure state-level delivery charges for checkout fallback when
              pincode mapping is unavailable.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            Mapped States: <span className="font-semibold">{mappedCount}</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="relative max-w-sm">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search state"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">State</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Delivery Fee
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Serviceable
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-600">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Loading state delivery fees...
                    </span>
                  </td>
                </tr>
              ) : filteredStates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-600">
                    No state found for this search.
                  </td>
                </tr>
              ) : (
                filteredStates.map((state) => {
                  const current = getCurrentRowValue(state);
                  const rowDirty = isRowDirty(state);
                  const isSaving = savingState === state;
                  const isDeleting = deletingState === state;
                  const mappedRate = ratesByState.get(state) as StateDeliveryRate | undefined;

                  return (
                    <tr key={state} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-2 text-gray-900">
                          <MapPinned size={14} className="text-indigo-600" />
                          <span className="font-medium">{state}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={current.charge}
                          onChange={(event) =>
                            handleDraftChange(state, {
                              charge: event.target.value,
                            })
                          }
                          placeholder="0.00"
                          className="w-36 rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-gray-700">
                          <input
                            type="checkbox"
                            checked={current.isServiceable}
                            onChange={(event) =>
                              handleDraftChange(state, {
                                isServiceable: event.target.checked,
                              })
                            }
                          />
                          Serviceable
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveRow(state)}
                            disabled={isSaving || isDeleting || !rowDirty}
                            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                          >
                            {isSaving ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Save size={12} />
                            )}
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearRow(state)}
                            disabled={isSaving || isDeleting || (!mappedRate && !rowDirty)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDeleting ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                            Clear
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <ConfirmModal
          isOpen={statePendingClear !== null}
          title="Remove state delivery mapping?"
          message={
            statePendingClear
              ? `Do you want to remove the saved delivery mapping for ${statePendingClear}?`
              : "Do you want to remove this saved delivery mapping?"
          }
          type="danger"
          confirmLabel="Remove"
          onConfirm={() => void confirmClearRow()}
          onCancel={() => setStatePendingClear(null)}
          isConfirming={
            statePendingClear !== null && deletingState === statePendingClear
          }
          disableCancelWhileConfirming
        />
      </div>
    </PermissionGuard>
  );
};

export default withAuth(DeliveryFeesDashboard);
