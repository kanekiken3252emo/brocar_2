"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Search } from "lucide-react";

interface SearchFormProps {
  onSearch: (params: { article?: string; brand?: string }) => void;
  isLoading?: boolean;
}

export function SearchForm({ onSearch, isLoading = false }: SearchFormProps) {
  const [article, setArticle] = useState("");
  const [brand, setBrand] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!article.trim() && !brand.trim()) {
      return;
    }

    onSearch({
      article: article.trim() || undefined,
      brand: brand.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="article">Артикул</Label>
          <Input
            id="article"
            type="text"
            placeholder="Например: 0986424012"
            value={article}
            onChange={(e) => setArticle(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand">Бренд</Label>
          <Input
            id="brand"
            type="text"
            placeholder="Например: Bosch"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>
        <Search className="mr-2 h-4 w-4" />
        {isLoading ? "Поиск..." : "Найти запчасти"}
      </Button>
    </form>
  );
}




