const FIELD_INCLUDE_TOKENS = new Set([
  "name",
  "fullname",
  "firstname",
  "lastname",
  "address",
  "line1",
  "line2",
  "line3",
  "street",
  "landmark",
  "city",
  "state",
  "country",
  "province",
  "district",
  "title",
  "category",
  "brand",
  "company",
  "business",
  "organization",
  "organisation",
  "locality",
  "region",
]);

const FIELD_EXCLUDE_TOKENS = new Set([
  "email",
  "password",
  "confirm",
  "url",
  "uri",
  "link",
  "slug",
  "sku",
  "coupon",
  "promo",
  "code",
  "id",
  "uuid",
  "token",
  "key",
  "hash",
  "filename",
  "file",
  "path",
  "endpoint",
  "otp",
  "barcode",
  "pin",
  "pincode",
  "postal",
  "zip",
  "phone",
  "mobile",
  "whatsapp",
  "quantity",
  "qty",
  "price",
  "amount",
  "tax",
  "gst",
  "vat",
  "search",
  "query",
  "operation",
  "graphql",
  "fragment",
  "mutation",
  "typename",
  "filter",
  "message",
  "comment",
  "description",
  "desc",
  "notes",
  "note",
  "content",
]);

const splitFieldTokens = (fieldHint: string): string[] => {
  if (!fieldHint) {
    return [];
  }

  const decamelized = fieldHint
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .toLowerCase();

  return decamelized
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
};

const capitalizeWord = (word: string): string => {
  if (!word) {
    return word;
  }

  return word
    .split("-")
    .map((hyphenPart) =>
      hyphenPart
        .split("'")
        .map((apostrophePart) =>
          apostrophePart
            ? `${apostrophePart.charAt(0).toUpperCase()}${apostrophePart
                .slice(1)
                .toLowerCase()}`
            : apostrophePart
        )
        .join("'")
    )
    .join("-");
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  if (value instanceof Date) {
    return false;
  }

  return Object.prototype.toString.call(value) === "[object Object]";
};

export const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

export const toTitleCaseWords = (value: string): string => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return normalized;
  }

  return normalized
    .split(" ")
    .map((word) => capitalizeWord(word))
    .join(" ");
};

export const shouldNormalizeFieldHint = (fieldHint: string): boolean => {
  const tokens = splitFieldTokens(fieldHint);
  if (!tokens.length) {
    return false;
  }

  if (tokens.some((token) => FIELD_EXCLUDE_TOKENS.has(token))) {
    return false;
  }

  return tokens.some((token) => FIELD_INCLUDE_TOKENS.has(token));
};

export const normalizeHumanTextForField = (
  value: string,
  fieldHint: string
): string => {
  if (!shouldNormalizeFieldHint(fieldHint)) {
    return value;
  }

  return toTitleCaseWords(value);
};

export const normalizePayloadTextFields = <T>(
  payload: T,
  fieldHint = ""
): T => {
  if (typeof payload === "string") {
    return normalizeHumanTextForField(payload, fieldHint) as T;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) =>
      normalizePayloadTextFields(item, fieldHint)
    ) as T;
  }

  if (!isPlainObject(payload)) {
    return payload;
  }

  return Object.entries(payload).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      acc[key] = normalizePayloadTextFields(value, key);
      return acc;
    },
    {}
  ) as T;
};
