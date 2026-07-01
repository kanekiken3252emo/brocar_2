import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbSchema } from "@/lib/seo/structured-data";

export interface Crumb {
  name: string;
  href: string;
}

/**
 * Видимые хлебные крошки + разметка BreadcrumbList (JSON-LD) из одних и тех же
 * данных — так структурированные крошки всегда совпадают с видимыми (требование
 * Google). items идут от «Главной» к текущей странице; последний пункт — не
 * ссылка (это сама страница).
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema(
          items.map((c) => ({ name: c.name, url: `${SITE_URL}${c.href}` }))
        )}
      />
      <nav
        aria-label="Хлебные крошки"
        className="flex items-center gap-2 text-sm text-neutral-500 flex-wrap"
      >
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <span key={c.href} className="flex items-center gap-2 min-w-0">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              {last ? (
                <span className="text-neutral-300 truncate max-w-[60vw] sm:max-w-md">
                  {c.name}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="hover:text-orange-500 transition-colors whitespace-nowrap"
                >
                  {c.name}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}
