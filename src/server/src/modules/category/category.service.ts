import AppError from "@/shared/errors/AppError";
import slugify from "@/shared/utils/slugify";
import ApiFeatures from "@/shared/utils/ApiFeatures";
import { CategoryRepository } from "./category.repository";
import prisma from "@/infra/database/database.config";
import { clearCategoryCache } from "@/modules/product/graphql/resolver";
import { normalizeHumanTextForField } from "@/shared/utils/textNormalization";

export class CategoryService {
  constructor(private categoryRepository: CategoryRepository) {}

  async getAllCategories(queryString: Record<string, any>) {
    const hasExplicitPagination =
      queryString?.page !== undefined || queryString?.limit !== undefined;

    const apiFeaturesBuilder = new ApiFeatures(queryString)
      .filter()
      .sort()
      .limitFields();

    const apiFeatures = hasExplicitPagination
      ? apiFeaturesBuilder.paginate().build()
      : apiFeaturesBuilder.build();

    const { where, orderBy, skip, take } = apiFeatures;

    const [categories, totalResults] = await Promise.all([
      this.categoryRepository.findManyCategories({
        where,
        orderBy,
        skip: hasExplicitPagination ? skip : undefined,
        take: hasExplicitPagination ? take : undefined,
        includeProducts: true,
      }),
      this.categoryRepository.countCategories(where),
    ]);

    const requestedPage = Number(queryString?.page) || 1;
    const requestedLimit = Number(queryString?.limit) || 16;
    const resultsPerPage = hasExplicitPagination
      ? requestedLimit
      : Math.max(totalResults, 1);
    const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));
    const currentPage = hasExplicitPagination
      ? Math.min(Math.max(requestedPage, 1), totalPages)
      : 1;

    return {
      categories,
      totalResults,
      totalPages,
      currentPage,
      resultsPerPage,
    };
  }

  async getCategory(categoryId: string) {
    const category = await this.categoryRepository.findCategoryById(categoryId, true);
    if (!category) {
      throw new AppError(404, "Category not found");
    }
    return {
        ...category,
        productCount: category.products?.length || 0,
      
    };
  }

  async createCategory(data: {
    name: string;
    description?: string;
    images?: string[];
    attributes?: { attributeId: string; isRequired: boolean }[];
  }) {
    const normalizedName = normalizeHumanTextForField(data.name, "name");
    const slug = slugify(normalizedName);
    const existingCategory = await prisma.category.findUnique({ where: { slug } });
    if (existingCategory) {
      throw new AppError(400, "Category with this name already exists");
    }

    // Validate attributes
    if (data.attributes) {
      for (const attr of data.attributes) {
        const attribute = await prisma.attribute.findUnique({ where: { id: attr.attributeId } });
        if (!attribute) {
          throw new AppError(404, `Attribute not found: ${attr.attributeId}`);
        }
      }
    }

    const category = await this.categoryRepository.createCategory({
      name: normalizedName,
      slug,
      description: data.description,
      images: data.images,
      attributes: data.attributes,
    });
    await clearCategoryCache();
    return { category };
  }

  async updateCategory(categoryId: string, data: {
    name?: string;
    description?: string;
    images?: string[];
  }) {
    const category = await this.categoryRepository.findCategoryById(categoryId);
    if (!category) {
      throw new AppError(404, "Category not found");
    }

    const normalizedName =
      data.name !== undefined
        ? normalizeHumanTextForField(data.name, "name")
        : undefined;
    const slug = normalizedName ? slugify(normalizedName) : undefined;
    if (slug && slug !== category.slug) {
      const existingCategory = await prisma.category.findUnique({ where: { slug } });
      if (existingCategory) {
        throw new AppError(400, "Category with this name already exists");
      }
    }

    const updatedCategory = await this.categoryRepository.updateCategory(categoryId, {
      name: normalizedName,
      slug,
      description: data.description,
      images: data.images,
    });
    await clearCategoryCache();
    return { category: updatedCategory };
  }

  async deleteCategory(categoryId: string) {
    const category = await this.categoryRepository.findCategoryById(categoryId);
    if (!category) {
      throw new AppError(404, "Category not found");
    }
    await this.categoryRepository.deleteCategory(categoryId);
    await clearCategoryCache();
  }

  async addCategoryAttribute(categoryId: string, attributeId: string, isRequired: boolean) {
    const category = await this.categoryRepository.findCategoryById(categoryId);
    if (!category) {
      throw new AppError(404, "Category not found");
    }
    const attribute = await prisma.attribute.findUnique({ where: { id: attributeId } });
    if (!attribute) {
      throw new AppError(404, "Attribute not found");
    }
    const existing = await prisma.categoryAttribute.findUnique({
      where: { categoryId_attributeId: { categoryId, attributeId } },
    });
    if (existing) {
      throw new AppError(400, "Attribute already assigned to category");
    }
    const categoryAttribute = await this.categoryRepository.addCategoryAttribute(categoryId, attributeId, isRequired);
    return { categoryAttribute };
  }

  async removeCategoryAttribute(categoryId: string, attributeId: string) {
    const category = await this.categoryRepository.findCategoryById(categoryId);
    if (!category) {
      throw new AppError(404, "Category not found");
    }
    const attribute = await prisma.attribute.findUnique({ where: { id: attributeId } });
    if (!attribute) {
      throw new AppError(404, "Attribute not found");
    }
    await this.categoryRepository.removeCategoryAttribute(categoryId, attributeId);
  }
}
