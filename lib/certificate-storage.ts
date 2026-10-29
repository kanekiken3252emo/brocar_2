import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

let cachedS3: S3Client | null = null;

function getS3Client(): S3Client {
  if (cachedS3) return cachedS3;

  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey || !process.env.S3_BUCKET) {
    throw new Error("S3 certificate storage is not configured");
  }

  cachedS3 = new S3Client({
    region: process.env.S3_REGION || "ru-msk",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });

  return cachedS3;
}

export async function getCertificateFile(key: string): Promise<{
  bytes: Uint8Array;
  contentLength: number;
}> {
  if (!key.startsWith("certificates/") || !key.endsWith(".pdf")) {
    throw new Error("Invalid certificate key");
  }

  const result = await getS3Client().send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET as string,
      Key: key,
    })
  );

  if (!result.Body) throw new Error("Certificate file is empty");

  const bytes = await result.Body.transformToByteArray();
  return {
    bytes,
    contentLength: result.ContentLength ?? bytes.byteLength,
  };
}
