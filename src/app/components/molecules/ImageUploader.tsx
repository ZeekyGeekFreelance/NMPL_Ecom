"use client";

import { ChevronLeft, ChevronRight, Trash2, Upload } from "lucide-react";
import {
  Control,
  FieldErrors,
  UseFormSetValue,
  useWatch,
} from "react-hook-form";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";

interface ImageUploaderProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  setValue: UseFormSetValue<any>;
  label: string;
  name?: string;
  maxFiles?: number;
  disabled?: boolean;
}

interface ImagePreview {
  url: string;
  value: File | string;
  isFile: boolean;
  filename: string;
}

const ImageUploader = ({
  control,
  errors,
  setValue,
  label,
  name = "images",
  maxFiles = 5,
  disabled = false,
}: ImageUploaderProps) => {
  const [previews, setPreviews] = useState<ImagePreview[]>([]);
  const filePreviewUrlsRef = useRef<string[]>([]);
  const watchedValue = useWatch({ control, name }) as
    | Array<File | string>
    | undefined;

  const currentValues = useMemo(
    () =>
      Array.isArray(watchedValue)
        ? watchedValue.filter(
            (value): value is File | string =>
              value instanceof File ||
              (typeof value === "string" && value.trim().length > 0)
          )
        : [],
    [watchedValue]
  );

  const getFilenameFromUrl = (url: string) => {
    try {
      const withoutQuery = url.split("?")[0];
      const segments = withoutQuery.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      return lastSegment || "Image";
    } catch {
      return "Image";
    }
  };

  const resolveFieldErrorMessage = () => {
    const pathSegments = name.replace(/\[(\d+)\]/g, ".$1").split(".");
    let cursor: any = errors;

    for (const segment of pathSegments) {
      if (!cursor || typeof cursor !== "object") {
        return undefined;
      }
      cursor = cursor[segment];
    }

    if (cursor && typeof cursor.message === "string") {
      return cursor.message as string;
    }

    return undefined;
  };

  useEffect(() => {
    filePreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    filePreviewUrlsRef.current = [];

    const mappedPreviews = currentValues.map((value) => {
      if (value instanceof File) {
        const objectUrl = URL.createObjectURL(value);
        filePreviewUrlsRef.current.push(objectUrl);

        return {
          url: objectUrl,
          value,
          isFile: true,
          filename: value.name,
        };
      }

      return {
        url: value,
        value,
        isFile: false,
        filename: getFilenameFromUrl(value),
      };
    });

    setPreviews(mappedPreviews);
  }, [currentValues]);

  useEffect(
    () => () => {
      filePreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      filePreviewUrlsRef.current = [];
    },
    []
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);

      if (!files.length) return;

      const remainingSlots = maxFiles - currentValues.length;
      const filesToAdd = files.slice(0, remainingSlots);

      if (filesToAdd.length < files.length) {
        alert(
          `Only ${remainingSlots} more files can be added. Maximum ${maxFiles} files allowed.`
        );
      }

      const updatedFiles = [...currentValues, ...filesToAdd];
      setValue(name, updatedFiles, { shouldValidate: true, shouldDirty: true });

      e.target.value = "";
    },
    [currentValues, maxFiles, name, setValue]
  );

  const removeImage = useCallback(
    (index: number) => {
      const nextValues = currentValues.filter(
        (_, currentIndex) => currentIndex !== index
      );
      setValue(name, nextValues, { shouldValidate: true, shouldDirty: true });
    },
    [currentValues, name, setValue]
  );

  const moveImage = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= currentValues.length ||
        toIndex >= currentValues.length ||
        fromIndex === toIndex
      ) {
        return;
      }

      const nextValues = [...currentValues];
      const [movedImage] = nextValues.splice(fromIndex, 1);
      nextValues.splice(toIndex, 0, movedImage);

      setValue(name, nextValues, { shouldValidate: true, shouldDirty: true });
    },
    [currentValues, name, setValue]
  );

  const canAddMore = currentValues.length < maxFiles;
  const errorMessage = resolveFieldErrorMessage();

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {maxFiles > 1 && (
          <span className="text-gray-500 text-xs ml-1">
            ({currentValues.length}/{maxFiles})
          </span>
        )}
      </label>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {previews.map((preview, index) => (
            <div
              key={`${preview.url}-${index}`}
              className="relative group aspect-square rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-50 hover:border-gray-300 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.url}
                alt={`Preview ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />

              <button
                type="button"
                onClick={() => removeImage(index)}
                disabled={disabled}
                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Remove image"
              >
                <Trash2 size={14} />
              </button>

              <div className="absolute top-1 left-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveImage(index, index - 1)}
                  disabled={disabled || index === 0}
                  className="bg-white/90 hover:bg-white text-gray-700 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Move image earlier"
                  title="Move earlier"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(index, index + 1)}
                  disabled={disabled || index === previews.length - 1}
                  className="bg-white/90 hover:bg-white text-gray-700 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Move image later"
                  title="Move later"
                >
                  <ChevronRight size={13} />
                </button>
              </div>

              <div
                className={`absolute bottom-1 left-1 text-white text-xs px-1.5 py-0.5 rounded ${
                  preview.isFile ? "bg-green-500" : "bg-blue-500"
                }`}
                title={preview.filename}
              >
                {preview.isFile ? "New" : "Saved"} #{index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="file"
          accept="image/*"
          multiple={maxFiles > 1}
          onChange={handleFileUpload}
          disabled={disabled || !canAddMore}
          className="hidden"
          id={`file-input-${name}`}
        />
        <label
          htmlFor={`file-input-${name}`}
          className={`
                flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                ${
                  disabled || !canAddMore
                    ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                    : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400"
                }
              `}
        >
          <Upload
            size={24}
            className={
              disabled || !canAddMore ? "text-gray-400" : "text-gray-500"
            }
          />
          <p
            className={`mt-2 text-sm ${
              disabled || !canAddMore ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {!canAddMore
              ? `Maximum ${maxFiles} files reached`
              : "Click to upload images or drag and drop"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            PNG, JPG, GIF, WEBP up to 10MB each
          </p>
        </label>
      </div>

      {errorMessage && (
        <p className="text-red-500 text-sm flex items-center gap-1">
          <span className="text-red-500">!</span>
          {errorMessage}
        </p>
      )}
    </div>
  );
};

export default ImageUploader;
