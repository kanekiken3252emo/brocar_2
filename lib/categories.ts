// Category to brands mapping for Berg.ru API
// Since Berg.ru doesn't support category search, we map categories to popular brands

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  brands: string[]; // Brands to search for this category
  keywords?: string[]; // Keywords to filter products by name (optional)
  searchArticles?: string[]; // Popular articles to search (optional)
  description?: string;
}

export const CATEGORIES: Record<string, Category> = {
  "popular-parts": {
    id: "popular-parts",
    name: "Популярные товары",
    icon: "⭐",
    color: "bg-gradient-to-br from-yellow-400 to-orange-500",
    brands: ["Bosch", "Mann", "TRW", "Castrol", "NGK"],
    searchArticles: [
      "GDB1044", "GDB1497", "W712/73", "C25114",
      "0986580340", "BF634", "P85020", "Z14",
    ],
    description: "Самые востребованные автозапчасти в наличии",
  },
  "brake-parts": {
    id: "brake-parts",
    name: "Тормозная система",
    icon: "🛑",
    color: "bg-red-500",
    brands: ["Brembo", "TRW", "ATE", "Bosch"],
    searchArticles: ["GDB1044", "GDB1497", "P85020", "P85073"],
    keywords: ["колодк", "тормозн", "brake", "pad"],
    description: "Тормозные колодки и диски",
  },
  "filters": {
    id: "filters",
    name: "Фильтры",
    icon: "🔄",
    color: "bg-blue-500",
    brands: ["Mann", "Bosch", "Mahle"],
    searchArticles: ["W712/73", "C25114", "HU7008Z", "W719/30"],
    keywords: ["фильтр", "filter"],
    description: "Масляные, воздушные, топливные фильтры",
  },
  "spark-plugs": {
    id: "spark-plugs",
    name: "Свечи зажигания",
    icon: "⚡",
    color: "bg-purple-400",
    brands: ["Bosch", "NGK", "Denso"],
    searchArticles: ["Z14", "BKR6E", "FR7DI30", "0242235667"],
    keywords: ["свеч", "spark", "plug"],
    description: "Свечи зажигания для бензиновых двигателей",
  },
};

// Get category by ID
export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES[id];
}

// Get all categories as array
export function getAllCategories(): Category[] {
  return Object.values(CATEGORIES);
}

// Filter products by category keywords
export function filterProductsByCategory(
  products: any[],
  category: Category
): any[] {
  if (!category.keywords || category.keywords.length === 0) {
    return products;
  }

  return products.filter((product) => {
    const searchText = `${product.name} ${product.article} ${product.brand}`.toLowerCase();
    
    // Check if any keyword matches
    return category.keywords!.some((keyword) =>
      searchText.includes(keyword.toLowerCase())
    );
  });
}

