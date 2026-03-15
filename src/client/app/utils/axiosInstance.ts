import axios, { AxiosInstance } from "axios";
import { API_BASE_URL } from "@/app/lib/constants/config";

const getCookie = (name: string): string | undefined => {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]+)`));
  return match ? match[2] : undefined;
};

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
    const csrfToken = getCookie("csrf-token");
    if (csrfToken && config.method && ["post", "put", "patch", "delete"].includes(config.method.toLowerCase())) {
      config.headers["x-csrf-token"] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosInstance;
