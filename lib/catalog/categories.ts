import categoriesData from "@/data/catalog-categories.json";

export interface CatalogArticle {
  article: string;
  brand: string;
}

export interface CatalogCategory {
  slug: string;
  title: string;
  description?: string;
  articles: CatalogArticle[];
}

interface CatalogData {
  categories: CatalogCategory[];
}

const data = categoriesData as CatalogData;

export function getAllCategories(): CatalogCategory[] {
  return data.categories;
}

export function getCategoryBySlug(slug: string): CatalogCategory | undefined {
  return data.categories.find((c) => c.slug === slug);
}
