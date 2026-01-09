import { useAuth } from "./use-auth";
import { formatMoney, formatMoneyWithDecimals, getCurrencySymbol, type Currency } from "@shared/currency";

export function useGymCurrency() {
  const { user } = useAuth();
  
  const currency: Currency = (user?.gym as { currency?: Currency })?.currency || "INR";
  
  const format = (amountInSmallestUnit: number) => formatMoney(amountInSmallestUnit, currency);
  const formatWithDecimals = (amountInSmallestUnit: number) => formatMoneyWithDecimals(amountInSmallestUnit, currency);
  const symbol = getCurrencySymbol(currency);
  
  return { 
    format, 
    formatWithDecimals,
    symbol, 
    currency,
    formatMoney: format,
  };
}
