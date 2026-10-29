import { NextResponse } from "next/server";
import { getCertificateFile } from "@/lib/certificate-storage";
import { getComplianceCertificate } from "@/lib/compliance-certificates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const certificate = getComplianceCertificate(id);

  if (!certificate) {
    return NextResponse.json(
      { error: "Сертификат не найден" },
      { status: 404 }
    );
  }

  try {
    const file = await getCertificateFile(certificate.fileKey);
    const filename = `certificate-${certificate.publicId}.pdf`;
    const body = Uint8Array.from(file.bytes).buffer;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(file.contentLength),
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (error) {
    console.error("Certificate file load failed", {
      publicId: certificate.publicId,
      error,
    });
    return NextResponse.json(
      { error: "Файл сертификата временно недоступен" },
      { status: 503 }
    );
  }
}
