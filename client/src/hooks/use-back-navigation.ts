import { useLocation, useSearch } from "wouter";
import { useAuth } from "./use-auth";

type RoleDashboard = {
  owner: string;
  trainer: string;
  member: string;
  admin: string;
};

const ROLE_DASHBOARDS: RoleDashboard = {
  owner: "/",
  trainer: "/",
  member: "/",
  admin: "/admin/dashboard"
};

export function useBackNavigation() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user } = useAuth();

  const getReturnTo = (): string | null => {
    const params = new URLSearchParams(searchString);
    return params.get("returnTo");
  };

  const getFallbackRoute = (): string => {
    if (!user) return "/";
    const role = user.role as keyof RoleDashboard;
    return ROLE_DASHBOARDS[role] || "/";
  };

  const goBack = () => {
    const returnTo = getReturnTo();
    
    if (returnTo) {
      navigate(returnTo);
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate(getFallbackRoute());
    }
  };

  const buildLinkWithReturn = (targetPath: string, currentPath?: string): string => {
    const from = currentPath || window.location.pathname;
    return `${targetPath}?returnTo=${encodeURIComponent(from)}`;
  };

  return {
    goBack,
    getReturnTo,
    getFallbackRoute,
    buildLinkWithReturn
  };
}
