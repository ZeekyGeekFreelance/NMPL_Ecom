type ApiResource = "product" | "category" | "attribute" | "variant";

const FILTER_FIELDS: Record<ApiResource, Set<string>> = {
  product: new Set(["id", "name", "slug", "description", "categoryId"]),
  category: new Set(["id", "name", "slug", "description"]),
  attribute: new Set(["id", "name", "slug"]),
  variant: new Set(["id", "sku", "barcode", "productId", "productSlug"]),
};

const SORT_FIELDS: Record<ApiResource, Set<string>> = {
  product: new Set(["createdAt", "updatedAt", "name", "slug", "salesCount", "categoryId"]),
  category: new Set(["createdAt", "updatedAt", "name", "slug"]),
  attribute: new Set(["createdAt", "updatedAt", "name", "slug"]),
  variant: new Set(["createdAt", "updatedAt", "sku", "price", "stock", "productId"]),
};

const SELECT_FIELDS: Record<ApiResource, Set<string>> = {
  product: new Set([
    "id",
    "name",
    "slug",
    "description",
    "price",
    "stock",
    "sku",
    "isNew",
    "isTrending",
    "isBestSeller",
    "isFeatured",
    "categoryId",
    "salesCount",
    "createdAt",
    "updatedAt",
  ]),
  category: new Set([
    "id",
    "name",
    "slug",
    "description",
    "images",
    "createdAt",
    "updatedAt",
  ]),
  attribute: new Set(["id", "name", "slug", "createdAt", "updatedAt"]),
  variant: new Set([
    "id",
    "sku",
    "price",
    "stock",
    "lowStockThreshold",
    "barcode",
    "productId",
    "createdAt",
    "updatedAt",
  ]),
};

const SEARCH_FIELDS: Record<ApiResource, string> = {
  product: "name",
  category: "name",
  attribute: "name",
  variant: "sku",
};

class ApiFeatures {
  private queryOptions: any;
  private queryString: Record<string, any>;
  private resource: ApiResource;

  constructor(queryString: Record<string, any>, resource: ApiResource = "product") {
    this.queryOptions = {};
    this.queryString = queryString;
    this.resource = resource;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ["page", "sort", "limit", "fields", "searchQuery"];
    excludedFields.forEach((el) => delete queryObj[el]);

    const filters: Record<string, any> = {};

    if (this.queryString.searchQuery) {
      const searchField = SEARCH_FIELDS[this.resource];
      filters[searchField] = {
        contains: this.queryString.searchQuery,
        mode: "insensitive",
      };
    }

    if (this.resource === "product" && this.queryString.category) {
      filters.category = {
        is: {
          slug: {
            equals: this.queryString.category,
            mode: "insensitive",
          },
        },
      };
      delete queryObj.category;
    }

    if (this.resource === "product" && this.queryString.bestselling) {
      filters.isBestSeller =
        this.queryString.bestselling.toLowerCase() === "true";
      delete queryObj.bestselling;
    }

    if (this.resource === "product" && this.queryString.featured) {
      filters.isFeatured = this.queryString.featured.toLowerCase() === "true";
      delete queryObj.featured;
    }

    if (this.resource === "product" && this.queryString.newarrival) {
      filters.isNew = this.queryString.newarrival.toLowerCase() === "true";
      delete queryObj.newarrival;
    }

    if (this.resource === "variant" && this.queryString.productSlug) {
      filters.productSlug = String(this.queryString.productSlug).trim();
      delete queryObj.productSlug;
    }

    for (const key in queryObj) {
      if (!queryObj[key] || !FILTER_FIELDS[this.resource].has(key)) {
        continue;
      }

      const value = queryObj[key];
      if (Array.isArray(value)) {
        filters[key] = { in: value };
      } else if (typeof value === "string" && value.includes(",")) {
        filters[key] = { in: value.split(",") };
      } else {
        filters[key] = {
          contains: value,
          mode: "insensitive",
        };
      }
    }

    this.queryOptions.where = filters;
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort
        .split(",")
        .map((field: string) => {
          const [key, order] = field.split(":");
          if (!SORT_FIELDS[this.resource].has(key)) {
            return null;
          }
          return { [key]: order === "desc" ? "desc" : "asc" };
        })
        .filter(Boolean);

      if (sortBy.length > 0) {
        this.queryOptions.orderBy = sortBy;
      }
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const requestedFields: string[] = String(this.queryString.fields)
        .split(",")
        .map((f: string) => f.trim())
        .filter((f: string) => SELECT_FIELDS[this.resource].has(f));

      if (requestedFields.length > 0) {
        this.queryOptions.select = requestedFields.reduce(
          (acc: Record<string, boolean>, field: string) => {
            acc[field] = true;
            return acc;
          },
          {}
        );
      }
    }
    return this;
  }

  paginate() {
    const page = Math.max(Number(this.queryString.page) || 1, 1);
    const limit = Math.min(Math.max(Number(this.queryString.limit) || 16, 1), 200);
    const skip = (page - 1) * limit;

    this.queryOptions.skip = skip;
    this.queryOptions.take = limit;
    return this;
  }

  build() {
    return this.queryOptions;
  }
}

export default ApiFeatures;
