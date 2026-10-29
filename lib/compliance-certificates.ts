export type ComplianceCertificate = {
  publicId: string;
  kind: "Сертификат соответствия";
  number: string;
  status: "Действует";
  validFrom: string;
  validFromLabel: string;
  validUntil: string;
  validUntilLabel: string;
  manufacturer: string;
  regulation: string;
  registry: string;
  registryUrl: string;
  fileKey: string;
  fileSha256: string;
  fileSize: number;
};

export type ProductCertificateSummary = Pick<
  ComplianceCertificate,
  "publicId" | "number" | "validUntilLabel"
>;

export interface CertificateProductReference {
  article: string;
  brand: string;
}

interface ProductCertificateBinding extends CertificateProductReference {
  certificateId: string;
}

const certificates: ComplianceCertificate[] = [
  {
    publicId: "eaes-ru-s-de-na96-v-03408-23",
    kind: "Сертификат соответствия",
    number: "ЕАЭС RU С-DE.НА96.В.03408/23",
    status: "Действует",
    validFrom: "2023-12-06",
    validFromLabel: "06.12.2023",
    validUntil: "2027-12-05",
    validUntilLabel: "05.12.2027",
    manufacturer: "ZF Friedrichshafen AG",
    regulation: "ТР ТС 018/2011",
    registry: "Реестр Росаккредитации",
    registryUrl: "https://pub.fsa.gov.ru/rss/certificate/view/3355646",
    fileKey:
      "certificates/pilot/bd93b40a101b1fb9bb085a341f91bfafd9a8fff044deb046dc600fa55dbfe20e.pdf",
    fileSha256:
      "bd93b40a101b1fb9bb085a341f91bfafd9a8fff044deb046dc600fa55dbfe20e",
    fileSize: 114348,
  },
  {
    publicId: "eaes-kg417-026-it-02-19225",
    kind: "Сертификат соответствия",
    number: "ЕАЭС KG417/026.IT.02.19225",
    status: "Действует",
    validFrom: "2025-05-21",
    validFromLabel: "21.05.2025",
    validUntil: "2029-05-20",
    validUntilLabel: "20.05.2029",
    manufacturer: "ERA S.r.l",
    regulation: "ТР ТС 018/2011",
    registry: "Единый реестр ЕАЭС",
    registryUrl:
      "https://tech.eaeunion.org/tech/registers/35-1/ru/registryList/conformityDocs/view/682dd97c30dcf80e6d47aedf",
    fileKey:
      "certificates/pilot/d450e4120abe370dd02808a7c7974d92a45714ddcf45aaac882db0af5ea9a308.pdf",
    fileSha256:
      "d450e4120abe370dd02808a7c7974d92a45714ddcf45aaac882db0af5ea9a308",
    fileSize: 175518,
  },
];

const certificatesById = new Map(
  certificates.map((certificate) => [certificate.publicId, certificate])
);

function productKey(article: string, brand: string): string {
  const normalizedArticle = article
    .replace(/[^a-z0-9а-яё]/gi, "")
    .toUpperCase();
  const normalizedBrand = brand.replace(/[^a-z0-9а-яё]/gi, "").toUpperCase();
  return `${normalizedBrand}:${normalizedArticle}`;
}

const productCertificateBindings: ProductCertificateBinding[] = [
  {
    article: "GDB1550",
    brand: "TRW",
    certificateId: "eaes-ru-s-de-na96-v-03408-23",
  },
  {
    article: "330005",
    brand: "ERA",
    certificateId: "eaes-kg417-026-it-02-19225",
  },
  {
    article: "550146",
    brand: "ERA",
    certificateId: "eaes-kg417-026-it-02-19225",
  },
  {
    article: "330089",
    brand: "ERA",
    certificateId: "eaes-kg417-026-it-02-19225",
  },
];

const certificateIdByProduct = new Map<string, string>(
  productCertificateBindings.map(({ article, brand, certificateId }) => [
    productKey(article, brand),
    certificateId,
  ])
);

export function getComplianceCertificate(
  publicId: string
): ComplianceCertificate | null {
  return certificatesById.get(publicId) ?? null;
}

export function getProductCertificate(
  article: string,
  brand: string
): ComplianceCertificate | null {
  const publicId = certificateIdByProduct.get(productKey(article, brand));
  return publicId ? getComplianceCertificate(publicId) : null;
}

export function getProductCertificateSummary(
  article: string,
  brand: string
): ProductCertificateSummary | null {
  const certificate = getProductCertificate(article, brand);
  if (!certificate) return null;

  return {
    publicId: certificate.publicId,
    number: certificate.number,
    validUntilLabel: certificate.validUntilLabel,
  };
}

export function getCertificateProductReferences(
  publicId: string
): CertificateProductReference[] {
  return productCertificateBindings
    .filter(({ certificateId }) => certificateId === publicId)
    .map(({ article, brand }) => ({ article, brand }));
}

export function resolveCertificateReturnProduct(
  publicId: string,
  article?: string,
  brand?: string
): CertificateProductReference | null {
  const products = getCertificateProductReferences(publicId);

  if (article && brand) {
    const requestedKey = productKey(article, brand);
    const matchingProduct = products.find(
      (product) => productKey(product.article, product.brand) === requestedKey
    );

    if (matchingProduct) return matchingProduct;
  }

  return products.length === 1 ? products[0] : null;
}

export function getCertificateStaticParams(): { id: string }[] {
  return certificates.map((certificate) => ({ id: certificate.publicId }));
}
