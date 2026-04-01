import { API_BASE_URL } from "@/app/lib/constants/config";
import { toOrderReference } from "./accountReference";
import { runWithGlobalActivity } from "@/app/lib/activityIndicator";

const getFileNameFromDisposition = (
  contentDisposition: string | null,
  fallback: string
) => {
  if (!contentDisposition) {
    return fallback;
  }

  const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (!fileNameMatch?.[1]) {
    return fallback;
  }

  return fileNameMatch[1];
};

const extractErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    return payload?.message || "Failed to download invoice";
  } catch {
    return "Failed to download invoice";
  }
};

const shouldRetryInvoiceDownload = (
  response: Response,
  message: string
): boolean =>
  response.status === 409 &&
  /invoice is available only after payment is confirmed|invoice is available only after payment confirmation/i.test(
    message
  );

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const requestInvoiceDownload = async (orderId: string) =>
  fetch(`${API_BASE_URL}/invoices/order/${orderId}/download`, {
    method: "GET",
    credentials: "include",
  });

export const downloadInvoiceByOrderId = async (orderId: string) =>
  runWithGlobalActivity(async () => {
    let response = await requestInvoiceDownload(orderId);

    if (!response.ok) {
      const firstErrorMessage = await extractErrorMessage(response);

      if (shouldRetryInvoiceDownload(response, firstErrorMessage)) {
        await sleep(900);
        response = await requestInvoiceDownload(orderId);
      } else {
        throw new Error(firstErrorMessage);
      }
    }

    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }

    const blob = await response.blob();
    const fallbackName = `invoice-${toOrderReference(orderId)}.pdf`;
    const fileName = getFileNameFromDisposition(
      response.headers.get("content-disposition"),
      fallbackName
    );

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  });
