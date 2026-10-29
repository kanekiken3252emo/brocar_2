import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCertificateProductReferences,
  getCertificateStaticParams,
  getComplianceCertificate,
  resolveCertificateReturnProduct,
} from "@/lib/compliance-certificates";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { productUrl } from "@/lib/product-url";

export const dynamicParams = false;

export function generateStaticParams() {
  return getCertificateStaticParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const certificate = getComplianceCertificate(id);

  if (!certificate) return {};

  return {
    title: `${certificate.kind} ${certificate.number}`,
    description: `${certificate.kind} на товар. Номер ${certificate.number}, действует до ${certificate.validUntilLabel}.`,
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function CertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const certificate = getComplianceCertificate(id);

  if (!certificate) notFound();

  const article = typeof sp.article === "string" ? sp.article : undefined;
  const brand = typeof sp.brand === "string" ? sp.brand : undefined;
  const products = getCertificateProductReferences(certificate.publicId);
  const returnProduct = resolveCertificateReturnProduct(
    certificate.publicId,
    article,
    brand
  );
  const returnProductHref = returnProduct
    ? productUrl(returnProduct.article, returnProduct.brand)
    : null;
  const certificatePath = `/certificates/${certificate.publicId}`;
  const crumbs = [
    { name: "Главная", href: "/" },
    { name: "Каталог", href: "/catalog" },
    ...(returnProduct && returnProductHref
      ? [
          {
            name: `${returnProduct.brand} ${returnProduct.article}`,
            href: returnProductHref,
          },
        ]
      : []),
    { name: certificate.kind, href: certificatePath },
  ];

  return (
    <main className="container mx-auto px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs items={crumbs} />

        <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
          <div className="border-b border-neutral-800 px-6 py-5">
            <p className="mb-2 text-sm text-neutral-400">Документ на товар</p>
            <h1 className="text-2xl font-bold text-white">
              {certificate.kind}
            </h1>
          </div>

          <dl className="divide-y divide-neutral-800">
            <div className="grid gap-1 px-6 py-4 sm:grid-cols-[220px_1fr] sm:gap-4">
              <dt className="text-sm text-neutral-400">Номер</dt>
              <dd className="break-words text-sm text-white">
                {certificate.number}
              </dd>
            </div>
            <div className="grid gap-1 px-6 py-4 sm:grid-cols-[220px_1fr] sm:gap-4">
              <dt className="text-sm text-neutral-400">Статус</dt>
              <dd className="text-sm text-green-400">{certificate.status}</dd>
            </div>
            <div className="grid gap-1 px-6 py-4 sm:grid-cols-[220px_1fr] sm:gap-4">
              <dt className="text-sm text-neutral-400">Срок действия</dt>
              <dd className="text-sm text-white">
                с {certificate.validFromLabel} по {certificate.validUntilLabel}
              </dd>
            </div>
            <div className="grid gap-1 px-6 py-4 sm:grid-cols-[220px_1fr] sm:gap-4">
              <dt className="text-sm text-neutral-400">Изготовитель</dt>
              <dd className="text-sm text-white">{certificate.manufacturer}</dd>
            </div>
            <div className="grid gap-1 px-6 py-4 sm:grid-cols-[220px_1fr] sm:gap-4">
              <dt className="text-sm text-neutral-400">
                Технический регламент
              </dt>
              <dd className="text-sm text-white">{certificate.regulation}</dd>
            </div>
            <div className="grid gap-1 px-6 py-4 sm:grid-cols-[220px_1fr] sm:gap-4">
              <dt className="text-sm text-neutral-400">Источник проверки</dt>
              <dd className="text-sm text-white">{certificate.registry}</dd>
            </div>
          </dl>

          <div className="border-t border-neutral-800 px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={`/api/certificates/${certificate.publicId}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
              >
                Открыть PDF
              </a>
              {returnProduct && returnProductHref ? (
                <Link
                  href={returnProductHref}
                  className="inline-flex items-center justify-center rounded-lg border border-neutral-700 px-5 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-800"
                >
                  ← Вернуться к товару {returnProduct.brand}{" "}
                  {returnProduct.article}
                </Link>
              ) : products.length === 0 ? (
                <Link
                  href="/catalog"
                  className="inline-flex items-center justify-center rounded-lg border border-neutral-700 px-5 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-800"
                >
                  Вернуться в каталог
                </Link>
              ) : null}
            </div>

            {!returnProduct && products.length > 0 && (
              <div className="mt-5 border-t border-neutral-800 pt-5">
                <p className="mb-3 text-sm text-neutral-400">
                  Товары с этим сертификатом
                </p>
                <div className="flex flex-wrap gap-2">
                  {products.map((product) => (
                    <Link
                      key={`${product.brand}:${product.article}`}
                      href={productUrl(product.article, product.brand)}
                      className="inline-flex items-center justify-center rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:border-orange-500 hover:text-orange-400"
                    >
                      {product.brand} {product.article}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
