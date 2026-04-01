"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useBulkProductsMutation } from "@/app/store/apis/ProductApi";
import useToast from "@/app/hooks/ui/useToast";

interface ProductFileUploadProps {
  onUploadSuccess: () => void;
  acceptedFormats?: string[];
}

const ProductFileUpload = ({
  onUploadSuccess,
  acceptedFormats = [".csv"],
}: ProductFileUploadProps) => {
  const [uploadProductsFile, { isLoading }] = useBulkProductsMutation();
  const { showToast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedFormatString = acceptedFormats.join(",");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const resetState = () => {
    setFileName("");
    setUploadStatus("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (
      !acceptedFormats
        .map((f) => f.replace(".", ""))
        .includes(fileExtension || "")
    ) {
      showToast(
        `Invalid file format. Please upload ${acceptedFormats.join(
          " or "
        )} files.`,
        "error"
      );
      return;
    }

    setFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await uploadProductsFile(formData).unwrap();
      setUploadStatus("success");
      showToast("Products imported successfully!", "success");
      onUploadSuccess();
      // Reset the state after 3 seconds of showing success
      setTimeout(resetState, 3000);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadStatus("error");
      showToast(
        "Failed to import products. Please check your file and try again.",
        "error"
      );
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-1/2 mx-auto">
      <div
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 transition-all duration-300 ${
          dragActive
            ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
            : uploadStatus === "success"
            ? "border-[var(--color-success)] bg-[var(--color-success-bg)]"
            : uploadStatus === "error"
            ? "border-[var(--color-error)] bg-[var(--color-error-bg)]"
            : "border-[var(--color-border-dark)] hover:border-[var(--color-primary-muted)] bg-[var(--color-surface-alt)] hover:bg-[var(--color-primary-light)]"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormatString}
          onChange={handleChange}
          className="hidden"
          disabled={isLoading}
        />

        {uploadStatus === "idle" ? (
          <>
            <div className="flex flex-col items-center space-y-2 mb-4">
              <div className="p-3 bg-[var(--color-primary-light)] rounded-full">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                {fileName
                  ? fileName
                  : "Drop product file here or click to upload"}
              </p>
              <p className="text-xs text-gray-500">
                Supports {acceptedFormats.join(", ")} files
              </p>
            </div>
            <button
              onClick={handleButtonClick}
              disabled={isLoading}
              className="btn-primary h-10 rounded-md px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  <span>Select File</span>
                </>
              )}
            </button>
          </>
        ) : uploadStatus === "success" ? (
          <div className="flex flex-col items-center space-y-2">
            <CheckCircle className="h-8 w-8 text-success" />
            <p className="text-sm font-medium text-[var(--color-success-hover)]">
              Upload successful!
            </p>
            <p className="text-xs text-gray-500">{fileName}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <XCircle className="h-8 w-8 text-[var(--color-error)]" />
            <p className="text-sm font-medium text-[var(--color-error-hover)]">Upload failed</p>
            <p className="text-xs text-gray-500">{fileName}</p>
            <button
              onClick={resetState}
              className="px-3 py-1 bg-white text-[var(--color-error)] border border-[var(--color-error)] rounded-md hover:bg-[var(--color-error-bg)] text-sm"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center text-xs text-gray-500">
        <AlertCircle className="h-3 w-3 mr-1" />
        <span>
          Upload CSV only. Required columns: name, sku, price, stock,
          categoryId, description, isNew, isTrending, isBestSeller, isFeatured,
          and optional lowStockThreshold.
        </span>
      </div>
    </div>
  );
};

export default ProductFileUpload;
