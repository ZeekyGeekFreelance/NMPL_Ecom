import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

let csrfToken = "";

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    credentials: "include",
    prepareHeaders: (headers) => {
      if (csrfToken) headers.set("x-csrf-token", csrfToken);
      return headers;
    },
  }),
  tagTypes: ["Products", "Cart", "Orders", "Users", "Categories", "Attributes", "Dealers", "Payments", "Gst", "Inventory", "Logs", "DeliveryRates", "Analytics"],
  endpoints: () => ({}),
});
