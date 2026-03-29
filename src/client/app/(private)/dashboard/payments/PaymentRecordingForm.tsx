"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useGetOrderByIdQuery } from "@/app/store/apis/OrderApi";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { Calendar, DollarSign, FileText, Loader2 } from "lucide-react";
import { toOrderReference, toTransactionReference } from "@/app/lib/utils/accountReference";
import LoadingDots from "@/app/components/feedback/LoadingDots";

type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CHEQUE";

interface PaymentFormData {
  paymentMethod: PaymentMethod;
  amount: number;
  paymentReceivedAt: string;
  notes?: string;
  // Bank transfer fields
  utrNumber?: string;
  bankName?: string;
  transferDate?: string;
  // Cheque fields
  chequeNumber?: string;
  chequeDate?: string;
  chequeClearingDate?: string;
}

interface PaymentRecordingFormProps {
  orderId: string | null;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

const PaymentRecordingForm = ({ orderId, onSubmit, onCancel }: PaymentRecordingFormProps) => {
  const formatPrice = useFormatPrice();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: orderData, isLoading } = useGetOrderByIdQuery(orderId || "", {
    skip: !orderId,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue
  } = useForm<PaymentFormData>({
    defaultValues: {
      paymentMethod: "CASH",
      paymentReceivedAt: new Date().toISOString().split('T')[0]
    }
  });

  const selectedPaymentMethod = watch("paymentMethod");
  const order = orderData?.order;
  const orderReference = order?.id ? toOrderReference(order.id) : "";
  const transactionReference =
    order?.transaction?.id ? toTransactionReference(order.transaction.id) : "";

  const handleFormSubmit = async (data: PaymentFormData) => {
    if (!orderId) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        orderId,
        paymentMethod: data.paymentMethod,
        amount: Number(data.amount),
        paymentReceivedAt: new Date(data.paymentReceivedAt),
        notes: data.notes,
        ...(data.paymentMethod === "BANK_TRANSFER" && {
          utrNumber: data.utrNumber,
          bankName: data.bankName,
          transferDate: data.transferDate ? new Date(data.transferDate) : undefined
        }),
        ...(data.paymentMethod === "CHEQUE" && {
          chequeNumber: data.chequeNumber,
          chequeDate: data.chequeDate ? new Date(data.chequeDate) : undefined,
          chequeClearingDate: data.chequeClearingDate ? new Date(data.chequeClearingDate) : undefined,
          bankName: data.bankName
        })
      };
      
      await onSubmit(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillOrderAmount = () => {
    if (order?.amount) {
      setValue("amount", order.amount);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <LoadingDots label="Loading" className="ml-2" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-gray-600">Order not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          <span>Order: <span className="font-mono font-medium text-gray-800">{orderReference}</span></span>
          {transactionReference && (
            <span>Transaction: <span className="font-mono font-medium text-gray-800">{transactionReference}</span></span>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <FileText size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Order Amount</p>
              <p className="font-semibold text-gray-900">{formatPrice(order.amount)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Calendar size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Order Date</p>
              <p className="font-semibold text-gray-900">
                {new Date(order.orderDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <DollarSign size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Dealer</p>
              <p className="font-semibold text-gray-900">{order.user.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex-1 flex flex-col">
        <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto">
          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["CASH", "BANK_TRANSFER", "CHEQUE"] as PaymentMethod[]).map((method) => (
                <label key={method} className="flex items-center">
                  <input
                    type="radio"
                    value={method}
                    {...register("paymentMethod", { required: "Payment method is required" })}
                    className="h-4 w-4 text-indigo-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {method === "BANK_TRANSFER" ? "Bank Transfer" : 
                     method === "CHEQUE" ? "Cheque" : "Cash"}
                  </span>
                </label>
              ))}
            </div>
            {errors.paymentMethod && (
              <p className="mt-1 text-xs text-red-600">{errors.paymentMethod.message}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Amount *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                {...register("amount", { 
                  required: "Amount is required",
                  min: { value: 0.01, message: "Amount must be greater than 0" }
                })}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="0.00"
              />
              <button
                type="button"
                onClick={fillOrderAmount}
                className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                Use Order Amount
              </button>
            </div>
            {errors.amount && (
              <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>
            )}
          </div>

          {/* Payment Received Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Received Date *
            </label>
            <input
              type="date"
              {...register("paymentReceivedAt", { required: "Payment date is required" })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            {errors.paymentReceivedAt && (
              <p className="mt-1 text-xs text-red-600">{errors.paymentReceivedAt.message}</p>
            )}
          </div>

          {/* Bank Transfer Fields */}
          {selectedPaymentMethod === "BANK_TRANSFER" && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-sm font-medium text-blue-900">Bank Transfer Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  UTR/Reference Number *
                </label>
                <input
                  type="text"
                  {...register("utrNumber", { 
                    required: selectedPaymentMethod === "BANK_TRANSFER" ? "UTR number is required" : false 
                  })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Enter UTR/IMPS/NEFT reference number"
                />
                {errors.utrNumber && (
                  <p className="mt-1 text-xs text-red-600">{errors.utrNumber.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Name *
                </label>
                <input
                  type="text"
                  {...register("bankName", { 
                    required: selectedPaymentMethod === "BANK_TRANSFER" ? "Bank name is required" : false 
                  })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Enter bank name"
                />
                {errors.bankName && (
                  <p className="mt-1 text-xs text-red-600">{errors.bankName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transfer Date
                </label>
                <input
                  type="date"
                  {...register("transferDate")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* Cheque Fields */}
          {selectedPaymentMethod === "CHEQUE" && (
            <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="text-sm font-medium text-green-900">Cheque Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cheque Number *
                </label>
                <input
                  type="text"
                  {...register("chequeNumber", { 
                    required: selectedPaymentMethod === "CHEQUE" ? "Cheque number is required" : false 
                  })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Enter cheque number"
                />
                {errors.chequeNumber && (
                  <p className="mt-1 text-xs text-red-600">{errors.chequeNumber.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Name *
                </label>
                <input
                  type="text"
                  {...register("bankName", { 
                    required: selectedPaymentMethod === "CHEQUE" ? "Bank name is required" : false 
                  })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Enter bank name"
                />
                {errors.bankName && (
                  <p className="mt-1 text-xs text-red-600">{errors.bankName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cheque Date
                </label>
                <input
                  type="date"
                  {...register("chequeDate")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clearing Date
                </label>
                <input
                  type="date"
                  {...register("chequeClearingDate")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty if cheque hasn&apos;t cleared yet
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              {...register("notes")}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Add any additional notes about this payment..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Recording...
                </span>
              ) : (
                "Record Payment"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PaymentRecordingForm;
