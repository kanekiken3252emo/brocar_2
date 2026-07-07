import { ChevronDown } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqPageSchema } from "@/lib/seo/structured-data";

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Видимый блок «Частые вопросы» + FAQPage-разметка из одних и тех же данных
 * (вопросы обязаны быть видимы на странице — требование Яндекса и Google,
 * иначе разметка считается спамом). Серверный компонент, аккордеон на
 * нативных <details> — работает без JS.
 */
export function FaqSection({
  items,
  className = "",
}: {
  items: FaqItem[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <section className={className}>
      <JsonLd data={faqPageSchema(items)} />
      <h2 className="text-xl md:text-2xl font-bold text-white mb-4">
        Частые вопросы
      </h2>
      <div className="space-y-3">
        {items.map((it) => (
          <details
            key={it.question}
            className="group bg-neutral-900 border border-neutral-800 rounded-xl open:border-orange-500/30 transition-colors"
          >
            <summary className="flex items-center justify-between gap-3 cursor-pointer select-none p-4 text-white text-sm md:text-base font-medium list-none [&::-webkit-details-marker]:hidden">
              {it.question}
              <ChevronDown className="h-4 w-4 text-orange-500 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-4 pb-4 text-neutral-400 text-sm leading-relaxed">
              {it.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
