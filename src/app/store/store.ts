import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "./api.slice";
import authReducer from "./auth.slice";
import toastReducer from "./toast.slice";
import cartReducer from "./cart.slice";

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    toast: toastReducer,
    cart: cartReducer,
  },
  middleware: (gDM) => gDM().concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
