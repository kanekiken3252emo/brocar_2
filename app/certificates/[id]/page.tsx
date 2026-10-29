import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCertificateStaticParams,
  getComplianceCertificate,
} from "@/lib/compliance-certificates";

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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const certificate = getComplianceCertificate(id);

  if (!certificate) notFound();

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-6 py-5">
          <p className="mb-2 text-sm text-neutral-400">Документ на товар</p>
          <h1 className="text-2xl font-bold text-white">{certificate.kind}</h1>
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
            <dt className="text-sm text-neutral-400">Технический регламент</dt>
            <dd className="text-sm text-white">{certificate.regulation}</dd>
          </div>
          <div className="grid gap-1 px-6 py-4 sm:grid-cols-[220px_1fr] sm:gap-4">
            <dt className="text-sm text-neutral-400">Источник проверки</dt>
            <dd className="text-sm text-white">{certificate.registry}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 border-t border-neutral-800 px-6 py-5 sm:flex-row">
          <a
            href={`/api/certificates/${certificate.publicId}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Открыть PDF
          </a>
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-700 px-5 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-800"
          >
            Вернуться в каталог
          </Link>
        </div>
      </div>
    </main>
  );
}
