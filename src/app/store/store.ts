import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "./slices/ApiSlice";
import authReducer from "./slices/AuthSlice";
import toastReducer from "./slices/ToastSlice";
import guestCartReducer from "./slices/GuestCartSlice";
import cartReducer from "./cart.slice";

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    toast: toastReducer,
    guestCart: guestCartReducer,
    cart: cartReducer,
  },
  middleware: (gDM) => gDM().concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;
