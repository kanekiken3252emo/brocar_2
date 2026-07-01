/**
 * Выводит один или несколько блоков JSON-LD (Schema.org) в разметку. Серверный
 * компонент — попадает прямо в первый HTML, поисковик видит без выполнения JS.
 * data строим конструкторами из lib/seo/structured-data.ts.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Значения — из наших же конструкторов (без пользовательского ввода).
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
