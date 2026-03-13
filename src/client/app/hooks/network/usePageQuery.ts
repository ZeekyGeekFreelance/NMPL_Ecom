"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useQueryParams from "./useQueryParams";

const toSafePage = (value: string | null, fallback = 1): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const page = Math.floor(parsed);
  return page > 0 ? page : fallback;
};

const usePageQuery = (fallbackPage = 1) => {
  const searchParams = useSearchParams();
  const { updateQuery } = useQueryParams();

  const page = useMemo(
    () => toSafePage(searchParams.get("page"), fallbackPage),
    [fallbackPage, searchParams]
  );

  const setPage = useCallback(
    (nextPage: number) => {
      if (!Number.isFinite(nextPage)) {
        return;
      }

      updateQuery({ page: Math.max(1, Math.floor(nextPage)) });
    },
    [updateQuery]
  );

  return { page, setPage };
};

export default usePageQuery;
