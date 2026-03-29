"use client";
import { Suspense } from "react";
import { Provider } from "react-redux";
import { store } from "./store/store";
import { ApolloProvider } from "@apollo/client";
import client from "./lib/apolloClient";
import Toast from "./components/feedback/Toast";
import AuthProvider from "./components/HOC/AuthProvider";
import ApolloAuthSync from "./components/HOC/ApolloAuthSync";
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
    <ApolloProvider client={client}>
      <Suspense fallback={null}>
        <TopLoadingBar />
      </Suspense>
      <GlobalActivityOverlay />
      <Provider store={store}>
        <AuthProvider>
          <CsrfTokenProvider />
          <ApolloAuthSync />
          <GlobalInputNormalizer />
          {children}
        </AuthProvider>
        {!runtimeEnv.isTest && <Toast />}
      </Provider>
    </ApolloProvider>
  );
}

