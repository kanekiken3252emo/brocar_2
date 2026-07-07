/**
 * Конструкторы Schema.org (JSON-LD). Держим ВСЮ разметку в одном месте, чтобы
 * данные организации (адрес, телефоны, соцсети, часы) не расползались по коду и
 * совпадали с тем, что показано на страницах (Контакты, футер).
 *
 * Рендерятся через <JsonLd> (components/seo/JsonLd.tsx). Значения @id связывают
 * сущности между собой (Product/Article ссылаются на одну и ту же Organization).
 */

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "BroCar";
const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN || "localhost:3000";

export const SITE_URL = siteDomain.startsWith("localhost")
  ? `http://${siteDomain}`
  : `https://${siteDomain}`;

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/**
 * Организация как автомагазин (AutoPartsStore ⊂ LocalBusiness). Даёт локальный
 * SEO-сигнал: адрес, геокоординаты, часы работы, телефоны, соцсети. Данные —
 * из страницы «Контакты» (app/contacts/page.tsx); держим синхронно.
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    "@id": ORG_ID,
    name: siteName,
    // Юр. данные опубликованы на /legal/requisites — помогают Яндексу склеить
    // сайт с карточкой организации (рейтинг/адрес в сниппете).
    legalName: "ИП Бакиров Артём Олегович",
    taxID: "660308104039",
    url: SITE_URL,
    logo: `${SITE_URL}/Logo_Brocar.png`,
    image: `${SITE_URL}/og-image.png`,
    telephone: "+79326006015",
    email: "info@brocarparts.ru",
    priceRange: "₽₽",
    currenciesAccepted: "RUB",
    paymentAccepted:
      "Наличные, банковская карта, СБП, безналичный расчёт для юрлиц",
    address: {
      "@type": "PostalAddress",
      streetAddress: "ул. Заводская, 16",
      addressLocality: "Екатеринбург",
      addressRegion: "Свердловская область",
      addressCountry: "RU",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 56.837552,
      longitude: 60.553018,
    },
    // ID организации в Яндексе — тот же, что в виджете рейтинга на /contacts.
    hasMap: "https://yandex.ru/maps/org/35950776894",
    areaServed: [
      { "@type": "City", name: "Екатеринбург" },
      { "@type": "Country", name: "Россия" },
    ],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "10:00",
        closes: "19:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "10:00",
        closes: "15:00",
      },
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: "+79326006015",
        contactType: "customer service",
        availableLanguage: "ru",
      },
      {
        "@type": "ContactPoint",
        telephone: "+73433822062",
        contactType: "sales",
        availableLanguage: "ru",
      },
    ],
    sameAs: [
      "https://vk.com/brocarparts",
      "https://t.me/+79326006015",
      "https://2gis.ru/ekaterinburg/firm/70000001098987045",
      "https://yandex.ru/maps/org/35950776894",
    ],
  };
}

/**
 * Листинг категории/марки (ItemList). items — товары первой страницы, которые
 * уже отрендерены в HTML (машиночитаемый список того, что и так видно).
 */
export function itemListSchema(input: {
  name: string;
  url: string;
  count: number;
  items: { name: string; url: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    url: input.url,
    numberOfItems: input.count,
    itemListElement: input.items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

/** Сайт + строка поиска (сайтлинк-серчбокс). Поиск по артикулу ведёт в каталог. */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: siteName,
    url: SITE_URL,
    inLanguage: "ru-RU",
    publisher: { "@id": ORG_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/catalog?article={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Хлебные крошки. items — в порядке от «Главной» к текущей странице. */
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/** Статья-гайд. Дат публикации в данных нет — не выдумываем, поля опускаем. */
export function articleSchema(input: {
  title: string;
  description: string;
  slug: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    image: `${SITE_URL}/og-image.png`,
    inLanguage: "ru-RU",
    mainEntityOfPage: `${SITE_URL}/guides/${input.slug}`,
    author: { "@type": "Organization", name: siteName, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: siteName,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/Logo_Brocar.png` },
    },
  };
}

/**
 * Товар. Offer добавляем ТОЛЬКО когда есть цена (иначе Google ругается на
 * оффер без цены). Наличие — из снимка каталога в первом HTML. Когда офферов
 * несколько (разные склады/поставщики) — отдаём AggregateOffer с честным
 * диапазоном цен: Яндекс показывает «от N ₽» в товарном сниппете.
 */
export function productSchema(input: {
  article: string;
  brand: string | null;
  name: string;
  image: string | null;
  url: string;
  price: number | null;
  highPrice?: number | null;
  offerCount?: number;
  inStock: boolean;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    sku: input.article,
    mpn: input.article,
    ...(input.brand ? { brand: { "@type": "Brand", name: input.brand } } : {}),
    ...(input.image ? { image: input.image } : {}),
  };

  if (input.price != null && input.price > 0) {
    const availability = input.inStock
      ? "https://schema.org/InStock"
      : "https://schema.org/PreOrder";
    schema.offers =
      (input.offerCount ?? 1) > 1
        ? {
            "@type": "AggregateOffer",
            url: input.url,
            lowPrice: input.price,
            highPrice: input.highPrice ?? input.price,
            offerCount: input.offerCount,
            priceCurrency: "RUB",
            availability,
            seller: { "@id": ORG_ID },
          }
        : {
            "@type": "Offer",
            url: input.url,
            price: input.price,
            priceCurrency: "RUB",
            itemCondition: "https://schema.org/NewCondition",
            availability,
            seller: { "@id": ORG_ID },
          };
  }

  return schema;
}
