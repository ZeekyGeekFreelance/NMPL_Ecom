import { apiSlice } from "../slices/ApiSlice";

export interface GstMaster {
  id: string;
  name: string;
  rate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const extractGst = (response: {
  gst?: GstMaster;
  data?: { gst?: GstMaster };
}) => {
  const gst = response.gst ?? response.data?.gst;

  if (!gst) {
    throw new Error("GST response payload is missing.");
  }

  return { gst };
};

export const gstApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllGsts: builder.query<{ gsts: GstMaster[] }, void>({
      query: () => ({
        url: "/gst",
        method: "GET",
      }),
      transformResponse: (response: { gsts?: GstMaster[]; data?: { gsts?: GstMaster[] } }) => ({
        gsts: response?.gsts || response?.data?.gsts || [],
      }),
      providesTags: ["Gst"],
    }),
    createGst: builder.mutation<
      { gst: GstMaster },
      { name: string; rate: number }
    >({
      query: (body) => ({
        url: "/gst",
        method: "POST",
        body,
      }),
      transformResponse: extractGst,
      invalidatesTags: ["Gst"],
    }),
    updateGst: builder.mutation<
      { gst: GstMaster },
      { id: string; name: string; rate: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/gst/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: extractGst,
      invalidatesTags: ["Gst"],
    }),
    toggleGstActivation: builder.mutation<
      { gst: GstMaster },
      { id: string; isActive: boolean }
    >({
      query: ({ id, isActive }) => ({
        url: `/gst/${id}/activate`,
        method: "PATCH",
        body: { isActive },
      }),
      transformResponse: extractGst,
      invalidatesTags: ["Gst"],
    }),
  }),
});

export const {
  useGetAllGstsQuery,
  useCreateGstMutation,
  useUpdateGstMutation,
  useToggleGstActivationMutation,
} = gstApi;
