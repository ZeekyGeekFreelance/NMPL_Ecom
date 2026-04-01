"use client";
import { Suspense } from "react";
import { Provider } from "react-redux";
import { store } from "./store/store";
import Toast from "./components/feedback/Toast";
import AuthProvider from "./components/HOC/AuthProvider";
import GlobalInputNormalizer from "./components/HOC/GlobalInputNormalizer";
import TopLoadingBar from "./components/feedback/TopLoadingBar";
import GlobalActivityOverlay from "./components/feedback/GlobalActivityOverlay";
import { runtimeEnv } from "./lib/runtimeEnv";
import { useCsrfToken } from "./hooks/useCsrfToken";

function CsrfTokenProvider() {
  useCsrfToken();
  return null;
}

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider store={store}>
      <Suspense fallback={null}>
        <TopLoadingBar />
      </Suspense>
      <GlobalActivityOverlay />
      <AuthProvider>
        <CsrfTokenProvider />
        <GlobalInputNormalizer />
        {children}
      </AuthProvider>
      {!runtimeEnv.isTest && <Toast />}
    </Provider>
  );
}
