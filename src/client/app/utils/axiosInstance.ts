import axios, { AxiosInstance } from "axios";
import { API_BASE_URL } from "@/app/lib/constants/config";

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  // Hard ceiling so a stalled backend never hangs the UI indefinitely.
  timeout: 30_000,
});

export default axiosInstance;
