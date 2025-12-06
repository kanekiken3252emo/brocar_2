import Link from "next/link";
import { Card, CardContent } from "./ui/card";
import { Wrench, Droplet, Filter, Settings, Zap, Disc, Sparkles, Package } from "lucide-react";

const CATEGORIES = [
  {
    name: "Тормозная система",
    icon: Disc,
    href: "/catalog?category=brakes",
    color: "bg-red-50 text-red-600",
  },
  {
    name: "Масла моторные",
    icon: Droplet,
    href: "/catalog?category=oils",
    color: "bg-yellow-50 text-yellow-700",
  },
  {
    name: "Фильтры",
    icon: Filter,
    href: "/catalog?category=filters",
    color: "bg-green-50 text-green-600",
  },
  {
    name: "Подвеска",
    icon: Settings,
    href: "/catalog?category=suspension",
    color: "bg-blue-50 text-blue-600",
  },
  {
    name: "Электрика",
    icon: Zap,
    href: "/catalog?category=electrical",
    color: "bg-purple-50 text-purple-600",
  },
  {
    name: "Колёса и диски",
    icon: Disc,
    href: "/catalog?category=wheels",
    color: "bg-gray-50 text-gray-700",
  },
  {
    name: "Омыватели",
    icon: Sparkles,
    href: "/catalog?category=fluids",
    color: "bg-cyan-50 text-cyan-600",
  },
  {
    name: "Аксессуары",
    icon: Package,
    href: "/catalog?category=accessories",
    color: "bg-orange-50 text-orange-600",
  },
];

export function CategoryGrid() {
  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Категории запчастей
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <Link key={category.name} href={category.href}>
                <Card className="h-full hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer border border-gray-200 hover:border-blue-400">
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 rounded-lg ${category.color}`}>
                      <Icon className="h-8 w-8" />
                    </div>
                    <h3 className="font-semibold text-gray-900">
                      {category.name}
                    </h3>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

