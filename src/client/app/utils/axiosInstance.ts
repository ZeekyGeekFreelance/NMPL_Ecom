import axios, { AxiosInstance } from "axios";
import { API_BASE_URL } from "@/app/lib/constants/config";
import {
  captureCsrfTokenFromHeaders,
  getCsrfToken,
} from "@/app/lib/csrfToken";

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  // Hard ceiling so a stalled backend never hangs the UI indefinitely.
  timeout: 30_000,
});

// Request interceptor to add CSRF token
axiosInstance.interceptors.request.use(
  (config) => {
    const csrfToken = getCsrfToken();
    if (csrfToken && config.method && ["post", "put", "patch", "delete"].includes(config.method.toLowerCase())) {
      config.headers["x-csrf-token"] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => {
    captureCsrfTokenFromHeaders(response.headers as Record<string, unknown>);
    return response;
  },
  (error) => {
    captureCsrfTokenFromHeaders(error?.response?.headers as Record<string, unknown> | undefined);
    return Promise.reject(error);
  }
);

export default axiosInstance;
