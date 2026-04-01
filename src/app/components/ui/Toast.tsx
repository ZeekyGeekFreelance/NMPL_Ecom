"use client";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { removeToast } from "@/app/store/toast.slice";
import { X } from "lucide-react";

const typeStyles = {
  success: "bg-green-600",
  error: "bg-red-600",
  warning: "bg-yellow-500",
  info: "bg-blue-600",
};

export function Toast() {
  const toasts = useAppSelector((s) => s.toast.toasts);
  const dispatch = useAppDispatch();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => dispatch(removeToast(t.id))} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: any; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 4000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  return (
    <div className={`${typeStyles[toast.type as keyof typeof typeStyles]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-right`}>
      <span className="text-sm">{toast.message}</span>
      <button onClick={onRemove} className="shrink-0 opacity-80 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  );
}
