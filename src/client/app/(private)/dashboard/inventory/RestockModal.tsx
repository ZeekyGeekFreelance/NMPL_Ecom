"use client";
import { useForm, Controller } from "react-hook-form";
import { useState } from "react";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import Modal from "@/app/components/organisms/Modal";

interface RestockFormData {
  quantity: number;
  notes?: string;
}

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (variantId: string, data: RestockFormData) => void | Promise<void>;
  variant: { id: string; sku: string } | null;
  isLoading?: boolean;
}

const RestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  variant,
  isLoading,
}) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingRestockData, setPendingRestockData] =
    useState<RestockFormData | null>(null);
  const form = useForm<RestockFormData>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      quantity: 0,
      notes: "",
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = form;

  const closeAll = () => {
    if (isLoading) {
      return;
    }
    setIsConfirmOpen(false);
    setPendingRestockData(null);
    onClose();
    reset();
  };

  const handleRequestRestock = (data: RestockFormData) => {
    setPendingRestockData(data);
    setIsConfirmOpen(true);
  };

  const handleConfirmRestock = async () => {
    if (!variant || !pendingRestockData) {
      setIsConfirmOpen(false);
      return;
    }

    await onSubmit(variant.id, pendingRestockData);
    setIsConfirmOpen(false);
    setPendingRestockData(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        open={isOpen}
        onClose={closeAll}
        contentClassName="max-w-2xl overflow-hidden p-0"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6">
            <h2 className="pr-12 text-lg font-semibold text-gray-900">
              Restock Variant: {variant?.sku}
            </h2>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <form
              onSubmit={handleSubmit(handleRequestRestock)}
              className="space-y-5"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Quantity
                </label>
                <Controller
                  name="quantity"
                  control={control}
                  rules={{
                    required: "Quantity is required",
                    min: { value: 1, message: "Quantity must be positive" },
                  }}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      className="w-full rounded-md border border-gray-300 px-3 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      placeholder="100"
                    />
                  )}
                />
                {errors.quantity && (
                  <p className="mt-1 text-xs text-red-500">{errors.quantity.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes (Optional)
                </label>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      className="w-full rounded-md border border-gray-300 px-3 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      placeholder="Restock notes..."
                      rows={3}
                    />
                  )}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading || !isValid}
                  className={`rounded-md px-5 py-2.5 font-medium text-white ${
                    isLoading || !isValid
                      ? "cursor-not-allowed bg-indigo-300"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {isLoading ? "Restocking..." : "Restock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Confirm Inventory Restock"
        message={
          pendingRestockData
            ? `You are adding ${pendingRestockData.quantity} unit(s) to ${variant?.sku}. This is a manual inventory correction and will be logged.`
            : "Confirm inventory restock?"
        }
        type="warning"
        confirmLabel="Confirm Restock"
        onConfirm={handleConfirmRestock}
        onCancel={() => {
          if (isLoading) {
            return;
          }
          setIsConfirmOpen(false);
          setPendingRestockData(null);
        }}
        isConfirming={Boolean(isLoading)}
        disableCancelWhileConfirming
      />
    </>
  );
};

export default RestockModal;
