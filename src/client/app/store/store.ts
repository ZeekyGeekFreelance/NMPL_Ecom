import { configureStore } from "@reduxjs/toolkit";
import toastReducer from "./slices/ToastSlice";
import { apiSlice } from "./slices/ApiSlice";
import authReducer from "./slices/AuthSlice";
import guestCartReducer from "./slices/GuestCartSlice";
import { runtimeEnv } from "../lib/runtimeEnv";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    guestCart: guestCartReducer,
    toasts: toastReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // RTK Query internally uses non-serializable values (e.g. AbortController,
        // Map) in its own slice. Ignore those paths rather than disabling the
        // check globally, so bugs in our own state are still caught.
        ignoredActions: ["api/executeQuery/pending", "api/executeQuery/fulfilled", "api/executeQuery/rejected"],
        ignoredPaths: ["api.queries", "api.mutations", "api.provided", "api.subscriptions"],
      },
    }).concat(apiSlice.middleware),
  devTools: !runtimeEnv.isProduction,
  preloadedState: {},
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

