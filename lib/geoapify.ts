import "server-only";

export type GeoapifyAddress = {
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
};

type GeoapifyResult = {
  name?: string;
  state?: string;
  state_code?: string;
  county?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  district?: string;
  city_district?: string;
  neighbourhood?: string;
  street?: string;
  housenumber?: string;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  result_type?: string;
  lat?: number | string;
  lon?: number | string;
};

type GeoapifyResponse = {
  results?: GeoapifyResult[];
};

const BRAZILIAN_STATE_CODES: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

export class GeoapifyError extends Error {
  constructor(
    message: string,
    public readonly code: "GEOAPIFY_NOT_CONFIGURED" | "GEOAPIFY_PROVIDER_ERROR",
    public readonly status: number,
  ) {
    super(message);
  }
}

export function isGeoapifyConfigured() {
  return Boolean(process.env.GEOAPIFY_API_KEY);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function normalizeStateCode(result: GeoapifyResult) {
  const rawCode = result.state_code?.trim().toUpperCase() ?? "";
  const code = rawCode.includes("-") ? rawCode.split("-").at(-1) ?? "" : rawCode;
  if (/^[A-Z]{2}$/.test(code)) return code;
  return BRAZILIAN_STATE_CODES[normalizeText(result.state ?? "")] ?? "";
}

function normalizeResult(result: GeoapifyResult): GeoapifyAddress | null {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const street = result.street?.trim()
    || (result.result_type === "street" ? result.name?.trim() : "")
    || "";

  return {
    street,
    number: result.housenumber?.trim() ?? "",
    district: result.suburb?.trim()
      || result.city_district?.trim()
      || result.district?.trim()
      || result.neighbourhood?.trim()
      || "",
    city: result.city?.trim()
      || result.town?.trim()
      || result.village?.trim()
      || result.municipality?.trim()
      || result.county?.trim()
      || "",
    state: normalizeStateCode(result),
    formattedAddress: result.formatted?.trim()
      || [result.address_line1, result.address_line2].filter(Boolean).join(", "),
    latitude,
    longitude,
  };
}

function storeBias(coordinates?: { latitude: number; longitude: number }) {
  if (coordinates) return `proximity:${coordinates.longitude},${coordinates.latitude}`;
  const latitude = Number(process.env.STORE_LATITUDE);
  const longitude = Number(process.env.STORE_LONGITUDE);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `proximity:${longitude},${latitude}`
    : "";
}

async function geoapifyRequest(path: string, params: Record<string, string>) {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    throw new GeoapifyError(
      "A busca de endereço ainda não foi configurada pela loja.",
      "GEOAPIFY_NOT_CONFIGURED",
      503,
    );
  }

  const url = new URL(path, "https://api.geoapify.com");
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  url.searchParams.set("apiKey", apiKey);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error("Geoapify API error", response.status);
      throw new GeoapifyError(
        "Não foi possível consultar o endereço agora. Tente novamente.",
        "GEOAPIFY_PROVIDER_ERROR",
        502,
      );
    }

    return await response.json() as GeoapifyResponse;
  } catch (error) {
    if (error instanceof GeoapifyError) throw error;
    console.error("Geoapify request failed", error instanceof Error ? error.name : "unknown");
    throw new GeoapifyError(
      "Não foi possível consultar o endereço agora. Tente novamente.",
      "GEOAPIFY_PROVIDER_ERROR",
      502,
    );
  }
}

export async function searchGeoapifyAddress(
  query: string,
  autocomplete: boolean,
  biasCoordinates?: { latitude: number; longitude: number },
) {
  const response = await geoapifyRequest(
    autocomplete ? "/v1/geocode/autocomplete" : "/v1/geocode/search",
    {
      text: query,
      format: "json",
      filter: "countrycode:br",
      bias: storeBias(biasCoordinates),
      lang: "pt",
      limit: autocomplete ? "6" : "1",
    },
  );

  return (response.results ?? []).flatMap((result) => {
    const normalized = normalizeResult(result);
    return normalized ? [normalized] : [];
  });
}

export async function reverseGeoapifyAddress(latitude: number, longitude: number) {
  const response = await geoapifyRequest("/v1/geocode/reverse", {
    lat: String(latitude),
    lon: String(longitude),
    format: "json",
    countrycodes: "br",
    lang: "pt",
    limit: "1",
  });
  const result = response.results?.[0];
  return result ? normalizeResult(result) : null;
}
