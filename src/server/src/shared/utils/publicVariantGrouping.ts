export type PublicVariantAttributeLike = {
  attribute?: { name?: string | null } | null;
  value?: { value?: string | null } | null;
};

export type PublicVariantSignatureLike = {
  id: string;
  attributes?: PublicVariantAttributeLike[] | null;
};

export type PublicVariantLike = PublicVariantSignatureLike & {
  price: number;
  retailPrice?: number | null;
  createdAt?: Date | string | null;
};

export const buildPublicVariantSignature = (
  variant: PublicVariantSignatureLike
): string => {
  const entries = (variant.attributes || [])
    .map((attribute) => {
      const attributeName = String(attribute?.attribute?.name || "").trim();
      const valueLabel = String(attribute?.value?.value || "").trim();
      if (!attributeName || !valueLabel) {
        return null;
      }
      if (attributeName.toLowerCase() === "brand") {
        return null;
      }
      return `${attributeName}:${valueLabel}`;
    })
    .filter((entry): entry is string => Boolean(entry))
    .sort((left, right) => left.localeCompare(right));

  return entries.length > 0 ? entries.join("|") : `variant:${variant.id}`;
};

const toComparableTimestamp = (
  value: Date | string | null | undefined
): number => {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const shouldReplaceVisibleVariant = (
  current: PublicVariantLike,
  candidate: PublicVariantLike
): boolean => {
  const currentEffectivePrice = Number(current.price ?? 0);
  const candidateEffectivePrice = Number(candidate.price ?? 0);
  if (candidateEffectivePrice !== currentEffectivePrice) {
    return candidateEffectivePrice < currentEffectivePrice;
  }

  const currentRetailPrice = Number(current.retailPrice ?? current.price ?? 0);
  const candidateRetailPrice = Number(
    candidate.retailPrice ?? candidate.price ?? 0
  );
  if (candidateRetailPrice !== currentRetailPrice) {
    return candidateRetailPrice < currentRetailPrice;
  }

  const currentCreatedAt = toComparableTimestamp(current.createdAt);
  const candidateCreatedAt = toComparableTimestamp(candidate.createdAt);
  if (candidateCreatedAt !== currentCreatedAt) {
    return candidateCreatedAt < currentCreatedAt;
  }

  return String(candidate.id) < String(current.id);
};

export const collapseVisibleVariants = <T extends PublicVariantLike>(
  variants: T[]
): T[] => {
  const visibleVariantsBySignature = new Map<string, T>();

  for (const variant of variants) {
    const signature = buildPublicVariantSignature(variant);
    const existing = visibleVariantsBySignature.get(signature);
    if (!existing) {
      visibleVariantsBySignature.set(signature, variant);
      continue;
    }

    if (shouldReplaceVisibleVariant(existing, variant)) {
      visibleVariantsBySignature.set(signature, variant);
    }
  }

  return Array.from(visibleVariantsBySignature.values());
};
