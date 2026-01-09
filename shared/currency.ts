export type Currency = "INR" | "USD";
export type Country = "India" | "USA";

export const REGION_CONFIG: Record<Country, {
  currency: Currency;
  locale: string;
  defaultTimezone: string;
  symbol: string;
}> = {
  India: {
    currency: "INR",
    locale: "en-IN",
    defaultTimezone: "Asia/Kolkata",
    symbol: "₹",
  },
  USA: {
    currency: "USD",
    locale: "en-US",
    defaultTimezone: "America/New_York",
    symbol: "$",
  },
};

export const CURRENCY_CONFIG: Record<Currency, {
  symbol: string;
  locale: string;
  divisor: number;
}> = {
  INR: { symbol: "₹", locale: "en-IN", divisor: 100 },
  USD: { symbol: "$", locale: "en-US", divisor: 100 },
};

export function formatMoney(amountInSmallestUnit: number, currency: Currency = "INR"): string {
  const config = CURRENCY_CONFIG[currency];
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountInSmallestUnit / config.divisor);
}

export function formatMoneyWithDecimals(amountInSmallestUnit: number, currency: Currency = "INR"): string {
  const config = CURRENCY_CONFIG[currency];
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInSmallestUnit / config.divisor);
}

export function getCurrencySymbol(currency: Currency = "INR"): string {
  return CURRENCY_CONFIG[currency].symbol;
}

export function getRegionConfig(country: Country) {
  return REGION_CONFIG[country] || REGION_CONFIG.India;
}

export function parseMoneyInput(value: string, currency: Currency = "INR"): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const amount = parseFloat(cleaned) || 0;
  return Math.round(amount * CURRENCY_CONFIG[currency].divisor);
}
