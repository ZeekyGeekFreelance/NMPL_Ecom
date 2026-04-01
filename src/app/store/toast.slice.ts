import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

interface ToastState { toasts: Toast[] }

const toastSlice = createSlice({
  name: "toast",
  initialState: { toasts: [] } as ToastState,
  reducers: {
    addToast(state, action: PayloadAction<Omit<Toast, "id">>) {
      state.toasts.push({ id: crypto.randomUUID(), ...action.payload });
    },
    removeToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const { addToast, removeToast } = toastSlice.actions;
export default toastSlice.reducer;
