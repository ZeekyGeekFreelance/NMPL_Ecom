"use client";

import { useMemo, useState } from "react";
import { Loader2, Percent, Plus, Power, Save } from "lucide-react";
import { withAuth } from "@/app/components/HOC/WithAuth";
import PermissionGuard from "@/app/components/auth/PermissionGuard";
import useToast from "@/app/hooks/ui/useToast";
import {
  useCreateGstMutation,
  useGetAllGstsQuery,
  useToggleGstActivationMutation,
  useUpdateGstMutation,
} from "@/app/store/apis/GstApi";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import LoadingDots from "@/app/components/feedback/LoadingDots";

type GstDraft = {
  name: string;
  rate: string;
};

const normalizeRateInput = (value: string) => value.replace(/[^\d.]/g, "");

const GstDashboard = () => {
  const { showToast } = useToast();
  const [newGst, setNewGst] = useState<GstDraft>({ name: "", rate: "" });
  const [drafts, setDrafts] = useState<Record<string, GstDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useGetAllGstsQuery();
  const [createGst] = useCreateGstMutation();
  const [updateGst] = useUpdateGstMutation();
  const [toggleGstActivation] = useToggleGstActivationMutation();

  const gsts = data?.gsts || [];
  const activeCount = useMemo(
    () => gsts.filter((gst) => gst.isActive).length,
    [gsts]
  );

  const getDraft = (id: string, fallbackName: string, fallbackRate: number): GstDraft =>
    drafts[id] || { name: fallbackName, rate: String(fallbackRate) };

  const isDirty = (id: string, fallbackName: string, fallbackRate: number) => {
    const draft = getDraft(id, fallbackName, fallbackRate);
    return (
      draft.name.trim() !== fallbackName ||
      draft.rate.trim() !== String(fallbackRate)
    );
  };

  const parseRate = (value: string) => {
    const parsed = Number(value.trim());
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return null;
    }
    return Number(parsed.toFixed(2));
  };

  const handleCreate = async () => {
    const name = newGst.name.trim();
    const rate = parseRate(newGst.rate);

    if (!name) {
      showToast("GST name is required.", "error");
      return;
    }

    if (rate === null) {
      showToast("GST rate must be between 0 and 100.", "error");
      return;
    }

    try {
      setCreating(true);
      await createGst({ name, rate }).unwrap();
      setNewGst({ name: "", rate: "" });
      showToast("GST master created successfully.", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to create GST master."), "error");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string, fallbackName: string, fallbackRate: number) => {
    const draft = getDraft(id, fallbackName, fallbackRate);
    const name = draft.name.trim();
    const rate = parseRate(draft.rate);

    if (!name) {
      showToast("GST name is required.", "error");
      return;
    }

    if (rate === null) {
      showToast("GST rate must be between 0 and 100.", "error");
      return;
    }

    try {
      setSavingId(id);
      await updateGst({ id, name, rate }).unwrap();
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      showToast("GST master updated successfully.", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to update GST master."), "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      setTogglingId(id);
      await toggleGstActivation({ id, isActive: !isActive }).unwrap();
      showToast(
        `GST master ${isActive ? "deactivated" : "activated"} successfully.`,
        "success"
      );
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to update GST activation."), "error");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <PermissionGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="type-h3 text-gray-900">GST Ledger</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create and maintain GST masters used by product pricing and checkout.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            Active GST Masters: <span className="font-semibold">{activeCount}</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_220px_auto]">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                GST Name
              </label>
              <input
                type="text"
                value={newGst.name}
                onChange={(event) =>
                  setNewGst((previous) => ({ ...previous, name: event.target.value }))
                }
                placeholder="GST 18%"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={newGst.rate}
                onChange={(event) =>
                  setNewGst((previous) => ({
                    ...previous,
                    rate: normalizeRateInput(event.target.value),
                  }))
                }
                placeholder="18"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Add GST
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Rate</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Updated
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <LoadingDots label="Loading" />
                    </span>
                  </td>
                </tr>
              ) : gsts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                    No GST masters created yet.
                  </td>
                </tr>
              ) : (
                gsts.map((gst) => {
                  const draft = getDraft(gst.id, gst.name, gst.rate);
                  const dirty = isDirty(gst.id, gst.name, gst.rate);
                  const isSaving = savingId === gst.id;
                  const isToggling = togglingId === gst.id;

                  return (
                    <tr key={gst.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(event) =>
                            setDrafts((previous) => ({
                              ...previous,
                              [gst.id]: {
                                ...draft,
                                name: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative w-36">
                          <Percent
                            size={14}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={draft.rate}
                            onChange={(event) =>
                              setDrafts((previous) => ({
                                ...previous,
                                [gst.id]: {
                                  ...draft,
                                  rate: normalizeRateInput(event.target.value),
                                },
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            gst.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {gst.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(gst.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdate(gst.id, gst.name, gst.rate)}
                            disabled={!dirty || isSaving}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSaving ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Save size={14} />
                            )}
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(gst.id, gst.isActive)}
                            disabled={isToggling}
                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                              gst.isActive ? "bg-gray-700" : "bg-emerald-600"
                            }`}
                          >
                            {isToggling ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Power size={14} />
                            )}
                            {gst.isActive ? "Deactivate" : "Activate"}
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
      </div>
    </PermissionGuard>
  );
};

export default withAuth(GstDashboard);
