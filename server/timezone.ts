import { Request } from "express";

export interface TimezoneContext {
  localDate: string;
  timezone: string;
}

export function getTimezoneContext(req: Request): TimezoneContext {
  const localDate = req.headers["x-local-date"] as string;
  const timezone = req.headers["x-local-timezone"] as string;
  
  if (!localDate || !timezone) {
    const serverDate = new Date().toISOString().split("T")[0];
    const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    if (!localDate || !timezone) {
      console.warn(`[Timezone] Missing client timezone info. Using server fallback: ${serverDate} (${serverTimezone})`);
    }
    
    return {
      localDate: localDate || serverDate,
      timezone: timezone || serverTimezone
    };
  }
  
  return { localDate, timezone };
}

export function getLocalDate(req: Request): string {
  return getTimezoneContext(req).localDate;
}
