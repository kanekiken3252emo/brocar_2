import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "./ui/card";

const CATEGORIES = [
  {
    name: "Тормозная система",
    img: "/tormoznaya-systema.png",
    href: "/catalog?category=brakes",
  },
  {
    name: "Масла моторные",
    img: "/oil.png",
    href: "/catalog?category=oils",
  },
  {
    name: "Фильтры",
    img: "/filtr.png",
    href: "/catalog?category=filters",
  },
  {
    name: "Подвеска",
    img: "/amortizator.png",
    href: "/catalog?category=suspension",
  },
  {
    name: "Электрика",
    img: "/avtoelektrika.png",
    href: "/catalog?category=electrical",
  },
  {
    name: "Колёса и диски",
    img: "/lotoi-disk.png",
    href: "/catalog?category=wheels",
  },
  {
    name: "Ремни ГРМ",
    img: "/remen-grm.png",
    href: "/catalog?category=fluids",
  },
  {
    name: "Аксессуары",
    img: "/avtoaksesuary.png",
    href: "/catalog?category=accessories",
  },
];

export function CategoryGrid() {
  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-white mb-8 text-center">
          Категории запчастей
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {CATEGORIES.map((category) => (
            <Link key={category.name} href={category.href}>
              <Card className="h-full bg-neutral-900 border-neutral-800 hover:border-orange-500/50 transition-all hover:-translate-y-1 cursor-pointer">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                  <div className="w-14 h-14 md:w-16 md:h-16">
                    <Image
                      src={category.img}
                      alt={category.name}
                      width={64}
                      height={64}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h3 className="font-semibold text-white text-sm md:text-base">
                    {category.name}
                  </h3>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
