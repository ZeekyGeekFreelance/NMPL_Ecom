"use client";
import { Provider } from "react-redux";
import { store } from "./store/store";
import { Toast } from "./components/ui/Toast";
import { TopLoadingBar } from "./components/ui/TopLoadingBar";
import { Suspense } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <Suspense fallback={null}>
        <TopLoadingBar />
      </Suspense>
      {children}
      <Toast />
    </Provider>
  );
}
