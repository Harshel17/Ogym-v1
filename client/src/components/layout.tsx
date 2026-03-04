import { useState, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationCounts } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoboDIcon } from "@/components/dika/dika-icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import { useKeyboardHeight } from "@/hooks/use-keyboard";
import { isIOS, isNative } from "@/lib/capacitor-init";
import { queryClient } from "@/lib/queryClient";
import ogymLogo from "@/assets/images/ogym-logo.png";
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  CreditCard, 
  LogOut, 
  Swords,
  TrendingUp,
  MessageSquare,
  Star,
  Utensils,
  UserCircle,
  ArrowRightLeft,
  Megaphone,
  Building2,
  UserPlus,
  Scale,
  FileText,
  Activity,
  Trophy,
  HelpCircle,
  Menu,
  PersonStanding,
  QrCode,
  Brain,
  BarChart3,
  HeartPulse,
  PhoneCall,
  MailCheck,
  Apple,
  Salad,
  Medal,
  Target,
  type LucideIcon
} from "lucide-react";

type MobileTabItem = {
  label: string;
  href: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  badge?: number;
};

function DikaNavIcon({ className }: { className?: string }) {
  return (
    <div className={cn("relative !w-[22px] !h-[22px]", className)}>
      <div className="w-full h-full rounded-[4px] bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center p-[2px]">
        <RoboDIcon className="w-full h-full text-white" />
      </div>
      <div className="absolute -top-[1px] -right-[1px] w-1 h-1 rounded-full bg-yellow-400" />
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const keyboardHeight = useKeyboardHeight();
  const isDikaWithKeyboard = location === '/dika' && keyboardHeight > 0;
  const { data: notificationCounts } = useNotificationCounts();
  const mainRef = useRef<HTMLElement | null>(null);
  
  const handlePullRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, []);
  
  const { setScrollElement, PullIndicator } = usePullRefresh({
    onRefresh: handlePullRefresh,
    threshold: 70,
  });
  
  const mainRefCallback = useCallback((el: HTMLElement | null) => {
    mainRef.current = el;
    setScrollElement(el);
  }, [setScrollElement]);
  
  // Mobile header removed - branding/logout/theme toggle moved to More drawer
  // CSS variable --tabbar-total-h is set in index.css for tab bar height

  if (!user) return null;

  const isIOSNativeApp = isNative() && isIOS();
  const isOwner = user.role === "owner";
  const isTrainer = user.role === "trainer";
  const isMember = user.role === "member";
  const hasGym = !!user.gymId;
  const isOwnerWithoutGym = isOwner && !hasGym;
  const isPropertyManager = isOwner && hasGym && user.gym?.propertyType && user.gym.propertyType !== "gym";

  const isPersonalMode = isMember && !hasGym;
  
  type NavItem = {
    label: string;
    href: string;
    icon: LucideIcon | React.ComponentType<{ className?: string }>;
    visible: boolean;
    badge: number;
    section: string;
    iconColor: string;
  };

  const navItems: NavItem[] = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard, visible: hasGym || isPersonalMode, badge: 0, section: "Main", iconColor: "text-blue-500 bg-blue-500/10" },
    { label: "Dika AI", href: "/dika", icon: DikaNavIcon, visible: (hasGym && !isPropertyManager) || isPersonalMode, badge: 0, section: "Main", iconColor: "text-amber-500 bg-amber-500/10" },
    { label: "Register Gym", href: "/gym-request", icon: Building2, visible: isOwnerWithoutGym && !isIOSNativeApp, badge: 0, section: "Main", iconColor: "text-emerald-500 bg-emerald-500/10" },
    { label: "My Workouts", href: "/my-workouts", icon: Swords, visible: isMember || isPersonalMode, badge: 0, section: "Fitness", iconColor: "text-orange-500 bg-orange-500/10" },
    { label: "Join a Gym", href: "/join-gym", icon: Building2, visible: isPersonalMode, badge: 0, section: "More", iconColor: "text-emerald-500 bg-emerald-500/10" },
    { label: "Profile", href: "/profile", icon: UserCircle, visible: hasGym || isPersonalMode, badge: 0, section: "Account", iconColor: "text-violet-500 bg-violet-500/10" },
    { label: "Trainers", href: "/trainers", icon: Users, visible: isOwner && hasGym && !isPropertyManager, badge: 0, section: "Management", iconColor: "text-cyan-500 bg-cyan-500/10" },
    { label: "Residents", href: "/members", icon: Users, visible: isPropertyManager, badge: 0, section: "Management", iconColor: "text-blue-500 bg-blue-500/10" },
    { label: "Access History", href: "/owner/access-history", icon: CalendarCheck, visible: !!isPropertyManager, badge: 0, section: "Management", iconColor: "text-emerald-500 bg-emerald-500/10" },
    { label: "Intelligence", href: "/owner/property-intelligence", icon: BarChart3, visible: !!isPropertyManager, badge: 0, section: "Management", iconColor: "text-indigo-500 bg-indigo-500/10" },
    { label: "Members", href: "/members", icon: Users, visible: (isOwner && hasGym && !isPropertyManager) || isTrainer, badge: 0, section: "Management", iconColor: "text-blue-500 bg-blue-500/10" },
    { label: "Attendance", href: "/attendance", icon: CalendarCheck, visible: hasGym && !isTrainer && !isPropertyManager, badge: 0, section: "Management", iconColor: "text-emerald-500 bg-emerald-500/10" },
    { label: "Payments", href: "/payments", icon: CreditCard, visible: ((isOwner && hasGym && !isPropertyManager) && !isIOSNativeApp) || (isMember && !isIOSNativeApp), badge: 0, section: "Management", iconColor: "text-green-500 bg-green-500/10" },
    { label: "Workouts", href: "/workouts", icon: Swords, visible: isTrainer, badge: 0, section: "Training", iconColor: "text-orange-500 bg-orange-500/10" },
    { label: "Star Members", href: "/star-members", icon: Star, visible: isTrainer, badge: 0, section: "Training", iconColor: "text-yellow-500 bg-yellow-500/10" },
    { label: "Diet Plans", href: "/diet-plans", icon: Utensils, visible: isTrainer, badge: 0, section: "Training", iconColor: "text-lime-500 bg-lime-500/10" },
    { label: "Templates", href: "/templates", icon: FileText, visible: isTrainer, badge: 0, section: "Training", iconColor: "text-slate-500 bg-slate-500/10" },
    { label: "Progress", href: "/progress", icon: TrendingUp, visible: isMember || isPersonalMode, badge: 0, section: "Fitness", iconColor: "text-emerald-500 bg-emerald-500/10" },
    { label: "My Diet Plan", href: "/my-diet-plan", icon: Utensils, visible: isMember, badge: 0, section: "Fitness", iconColor: "text-lime-500 bg-lime-500/10" },
    { label: "My Body", href: "/my-body", icon: Scale, visible: isMember || isPersonalMode, badge: 0, section: "Fitness", iconColor: "text-pink-500 bg-pink-500/10" },
    { label: "Nutrition", href: "/nutrition", icon: Apple, visible: isMember || isPersonalMode, badge: 0, section: "Fitness", iconColor: "text-red-500 bg-red-500/10" },
    { label: "Sports Mode", href: "/sports-mode", icon: Medal, visible: isMember || isPersonalMode, badge: 0, section: "Fitness", iconColor: "text-amber-500 bg-amber-500/10" },
    { label: "My Goals", href: "/goals", icon: Target, visible: isMember || isPersonalMode, badge: 0, section: "Fitness", iconColor: "text-rose-500 bg-rose-500/10" },
    { label: "Health", href: "/health", icon: HeartPulse, visible: isMember || isPersonalMode, badge: 0, section: "Fitness", iconColor: "text-red-500 bg-red-500/10" },
    { label: "Requests", href: "/requests", icon: MessageSquare, visible: isMember || isTrainer, badge: notificationCounts?.pendingRequests || 0, section: "More", iconColor: "text-blue-500 bg-blue-500/10" },
    { label: "Transfers", href: "/transfers", icon: ArrowRightLeft, visible: isOwner && hasGym && !isPropertyManager && !isIOSNativeApp, badge: notificationCounts?.pendingTransfers || 0, section: "Management", iconColor: "text-indigo-500 bg-indigo-500/10" },
    { label: "Announcements", href: "/owner/announcements", icon: Megaphone, visible: isOwner && hasGym && !isPropertyManager, badge: 0, section: "Growth", iconColor: "text-violet-500 bg-violet-500/10" },
    { label: "Walk-ins", href: "/owner/walk-in-visitors", icon: PersonStanding, visible: isOwner && hasGym && !isPropertyManager && !isIOSNativeApp, badge: notificationCounts?.hotLeadsCount || 0, section: "Growth", iconColor: "text-orange-500 bg-orange-500/10" },
    { label: "Follow-ups", href: "/owner/follow-ups", icon: PhoneCall, visible: isOwner && hasGym && !isPropertyManager && !isIOSNativeApp, badge: 0, section: "Growth", iconColor: "text-teal-500 bg-teal-500/10" },
    { label: "Dika Actions", href: "/owner/ai-insights", icon: Brain, visible: isOwner && hasGym && !isPropertyManager && !isIOSNativeApp, badge: 0, section: "AI Tools", iconColor: "text-purple-500 bg-purple-500/10" },
    { label: "Dika Intelligence", href: "/owner/gym-intelligence", icon: BarChart3, visible: isOwner && hasGym && !isPropertyManager && !isIOSNativeApp, badge: 0, section: "AI Tools", iconColor: "text-indigo-500 bg-indigo-500/10" },
    { label: "Self Check-in", href: "/owner/kiosk", icon: QrCode, visible: isOwner && hasGym, badge: 0, section: "More", iconColor: "text-sky-500 bg-sky-500/10" },
    { label: "Announcements", href: "/announcements", icon: Megaphone, visible: isTrainer || isMember, badge: notificationCounts?.unreadAnnouncements || 0, section: "More", iconColor: "text-violet-500 bg-violet-500/10" },
    { label: "Feed", href: "/feed", icon: Activity, visible: hasGym && !isPropertyManager, badge: 0, section: "More", iconColor: "text-sky-500 bg-sky-500/10" },
    { label: "Tournaments", href: "/tournaments", icon: Trophy, visible: hasGym && !isPropertyManager, badge: 0, section: "More", iconColor: "text-yellow-500 bg-yellow-500/10" },
    { label: "Join Requests", href: "/owner/join-requests", icon: UserPlus, visible: isOwner && !!user.gymId && !isPropertyManager, badge: notificationCounts?.pendingJoinRequests || 0, section: "Management", iconColor: "text-teal-500 bg-teal-500/10" },
    { label: "Help", href: "/help", icon: HelpCircle, visible: true, badge: 0, section: "Account", iconColor: "text-slate-400 bg-slate-400/10" },
    { label: "Support", href: "/support", icon: MessageSquare, visible: true, badge: 0, section: "Account", iconColor: "text-slate-400 bg-slate-400/10" },
  ];

  const sectionOrder = ["Main", "Management", "Training", "Fitness", "Growth", "AI Tools", "More", "Account"];
  const visibleItems = navItems.filter(item => item.visible);
  const groupedNav = sectionOrder
    .map(section => ({
      section,
      items: visibleItems.filter(item => item.section === section),
    }))
    .filter(group => group.items.length > 0);

  const getMobileNavigation = (): { primary: MobileTabItem[], secondary: MobileTabItem[] } => {
    if (isPropertyManager) {
      return {
        primary: [
          { label: "Dashboard", href: "/", icon: LayoutDashboard },
          { label: "Residents", href: "/members", icon: Users },
          { label: "History", href: "/owner/access-history", icon: CalendarCheck },
        ],
        secondary: [
          { label: "Intelligence", href: "/owner/property-intelligence", icon: BarChart3 },
          { label: "Self Check-in", href: "/owner/kiosk", icon: QrCode },
          { label: "Profile", href: "/profile", icon: UserCircle },
          { label: "Help", href: "/help", icon: HelpCircle },
          { label: "Support", href: "/support", icon: MessageSquare },
        ]
      };
    }
    if (isOwner && hasGym) {
      return {
        primary: isIOSNativeApp
          ? [
              { label: "Dashboard", href: "/", icon: LayoutDashboard },
              { label: "Members", href: "/members", icon: Users },
              { label: "Dika AI", href: "/dika", icon: DikaNavIcon },
              { label: "Attendance", href: "/owner/attendance", icon: CalendarCheck },
            ]
          : [
              { label: "Dashboard", href: "/", icon: LayoutDashboard },
              { label: "Members", href: "/members", icon: Users },
              { label: "Dika AI", href: "/dika", icon: DikaNavIcon },
              { label: "Payments", href: "/payments", icon: CreditCard },
            ],
        secondary: [
          ...(!isIOSNativeApp ? [{ label: "Attendance", href: "/owner/attendance", icon: CalendarCheck }] : []),
          { label: "Trainers", href: "/trainers", icon: Users },
          ...(!isIOSNativeApp ? [{ label: "Transfers", href: "/transfers", icon: ArrowRightLeft, badge: notificationCounts?.pendingTransfers || 0 }] : []),
          { label: "Announcements", href: "/owner/announcements", icon: Megaphone },
          ...(!isIOSNativeApp ? [
            { label: "Walk-ins", href: "/owner/walk-in-visitors", icon: PersonStanding, badge: notificationCounts?.hotLeadsCount || 0 },
            { label: "Follow-ups", href: "/owner/follow-ups", icon: PhoneCall },
          ] : []),
          { label: "Self Check-in", href: "/owner/kiosk", icon: QrCode },
          ...(!isIOSNativeApp ? [{ label: "Dika Actions", href: "/owner/ai-insights", icon: Brain }] : []),
          ...(!isIOSNativeApp ? [{ label: "Dika Intelligence", href: "/owner/gym-intelligence", icon: BarChart3 }] : []),
          ...(!isIOSNativeApp ? [{ label: "Auto Emails", href: "/owner/automated-emails", icon: MailCheck }] : []),
          { label: "Feed", href: "/feed", icon: Activity },
          { label: "Tournaments", href: "/tournaments", icon: Trophy },
          { label: "Join Requests", href: "/owner/join-requests", icon: UserPlus, badge: notificationCounts?.pendingJoinRequests || 0 },
          { label: "Profile", href: "/profile", icon: UserCircle },
          { label: "Help", href: "/help", icon: HelpCircle },
          { label: "Support", href: "/support", icon: MessageSquare },
        ]
      };
    }
    if (isOwner && !hasGym) {
      return {
        primary: isIOSNativeApp
          ? [
              { label: "Help", href: "/help", icon: HelpCircle },
              { label: "Profile", href: "/profile", icon: UserCircle },
            ]
          : [
              { label: "Register", href: "/gym-request", icon: Building2 },
              { label: "Help", href: "/help", icon: HelpCircle },
              { label: "Profile", href: "/profile", icon: UserCircle },
            ],
        secondary: [
          { label: "Support", href: "/support", icon: MessageSquare },
        ]
      };
    }
    if (isTrainer) {
      return {
        primary: [
          { label: "Dashboard", href: "/", icon: LayoutDashboard },
          { label: "Workouts", href: "/workouts", icon: Swords },
          { label: "Dika AI", href: "/dika", icon: DikaNavIcon },
          { label: "Members", href: "/members", icon: Users },
        ],
        secondary: [
          { label: "Requests", href: "/requests", icon: MessageSquare, badge: notificationCounts?.pendingRequests || 0 },
          { label: "Star Members", href: "/star-members", icon: Star },
          { label: "Diet Plans", href: "/diet-plans", icon: Utensils },
          { label: "Templates", href: "/templates", icon: FileText },
          { label: "Announcements", href: "/announcements", icon: Megaphone, badge: notificationCounts?.unreadAnnouncements || 0 },
          { label: "Feed", href: "/feed", icon: Activity },
          { label: "Tournaments", href: "/tournaments", icon: Trophy },
          { label: "Profile", href: "/profile", icon: UserCircle },
          { label: "Help", href: "/help", icon: HelpCircle },
          { label: "Support", href: "/support", icon: MessageSquare },
        ]
      };
    }
    if (isMember && hasGym) {
      return {
        primary: [
          { label: "Dashboard", href: "/", icon: LayoutDashboard },
          { label: "Workout", href: "/my-workouts", icon: Swords },
          { label: "Dika AI", href: "/dika", icon: DikaNavIcon },
          { label: "Nutrition", href: "/nutrition", icon: Salad },
        ],
        secondary: [
          { label: "Attendance", href: "/attendance", icon: CalendarCheck },
          { label: "Progress", href: "/progress", icon: TrendingUp },
          { label: "My Body", href: "/my-body", icon: Scale },
          { label: "My Diet", href: "/my-diet-plan", icon: Utensils },
          ...(!isIOSNativeApp ? [{ label: "Payments", href: "/payments", icon: CreditCard }] : []),
          { label: "Requests", href: "/requests", icon: MessageSquare, badge: notificationCounts?.pendingRequests || 0 },
          { label: "Announcements", href: "/announcements", icon: Megaphone, badge: notificationCounts?.unreadAnnouncements || 0 },
          { label: "Feed", href: "/feed", icon: Activity },
          { label: "Tournaments", href: "/tournaments", icon: Trophy },
          { label: "Sports Mode", href: "/sports-mode", icon: Medal },
          { label: "My Goals", href: "/goals", icon: Target },
          { label: "Profile", href: "/profile", icon: UserCircle },
          { label: "Help", href: "/help", icon: HelpCircle },
          { label: "Support", href: "/support", icon: MessageSquare },
        ]
      };
    }
    if (isMember && !hasGym) {
      return {
        primary: [
          { label: "Dashboard", href: "/", icon: LayoutDashboard },
          { label: "Workouts", href: "/my-workouts", icon: Swords },
          { label: "Dika AI", href: "/dika", icon: DikaNavIcon },
          { label: "Nutrition", href: "/nutrition", icon: Salad },
        ],
        secondary: [
          { label: "Progress", href: "/progress", icon: TrendingUp },
          { label: "My Body", href: "/my-body", icon: HeartPulse },
          { label: "Sports Mode", href: "/sports-mode", icon: Medal },
          { label: "My Goals", href: "/goals", icon: Target },
          { label: "Profile", href: "/profile", icon: UserCircle },
          { label: "Join Gym", href: "/join-gym", icon: Building2 },
          { label: "Help", href: "/help", icon: HelpCircle },
          { label: "Support", href: "/support", icon: MessageSquare },
        ]
      };
    }
    return {
      primary: [
        { label: "Dashboard", href: "/", icon: LayoutDashboard },
        { label: "Profile", href: "/profile", icon: UserCircle },
      ],
      secondary: []
    };
  };

  const { primary: primaryTabs, secondary: secondaryTabs } = getMobileNavigation();
  const hasMoreMenu = secondaryTabs.length > 0;
  const secondaryBadgeCount = secondaryTabs.reduce((sum, item) => sum + (item.badge || 0), 0);

  return (
    <div className="min-h-[100dvh] bg-secondary/30 flex flex-col md:flex-row md:overflow-hidden">
      {/* Sidebar - Desktop only */}
      <aside className="w-64 hidden md:flex flex-col min-h-[100dvh] z-10 sidebar-premium">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl shadow-lg shadow-primary/25 overflow-hidden flex items-center justify-center ring-1 ring-white/10">
                <img src={ogymLogo} alt="OGym" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-display font-bold text-lg leading-none magic-text">OGym</h1>
                  <div className="flex items-center gap-1 px-1.5 pr-2.5 py-1 rounded-md bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm border border-amber-500/20 shadow-sm">
                    <div className="w-5 h-5 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <RoboDIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[10px] font-mono font-bold tracking-wider text-amber-600 dark:text-amber-400 uppercase">AI</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Fitness Management</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex-1 px-3 pb-2 overflow-y-auto sidebar-nav-scroll">
          {groupedNav.map((group, gi) => (
            <div key={group.section} className={gi > 0 ? "mt-4" : ""}>
              {group.section !== "Main" && (
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/50">
                  {group.section}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div 
                        className={cn(
                          "group relative flex items-center justify-between gap-2.5 pl-3 pr-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer",
                          isActive 
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        )}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary-foreground/70" />
                        )}
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                            isActive ? "bg-white/15" : item.iconColor.split(' ').slice(1).join(' ')
                          )}>
                            <item.icon className={cn(
                              "w-[15px] h-[15px]",
                              isActive ? "text-primary-foreground" : item.iconColor.split(' ')[0]
                            )} />
                          </div>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge > 0 && (
                          <span 
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center rounded-full",
                              isActive 
                                ? "bg-white/20 text-primary-foreground" 
                                : "bg-primary text-primary-foreground"
                            )}
                            data-testid={`badge-${item.label.toLowerCase().replace(/\s+/g, '-')}-count`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 pt-0">
          <div className="rounded-xl p-3 mb-3 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 border border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-primary/20 ring-2 ring-primary/10">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-semibold truncate">{user.username}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
            {user.gym && isOwner && (
              <div className="mt-2.5 pt-2.5 border-t border-border/30">
                 <div className="flex items-center justify-between">
                   <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gym Code</p>
                   <p className="font-mono text-[11px] font-bold bg-background/80 px-2 py-0.5 rounded-md border border-border/50 select-all">
                     {user.gym.code}
                   </p>
                 </div>
              </div>
            )}
          </div>
          
          <button 
            className="w-full flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-lg text-[13px] font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/8 transition-all duration-200"
            onClick={() => logoutMutation.mutate()}
            data-testid="button-sign-out"
          >
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-destructive/8">
              <LogOut className="w-[15px] h-[15px]" />
            </div>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content - scrollable naturally */}
      <main ref={mainRefCallback} className={cn("flex-1 min-w-0 md:overflow-y-auto overflow-x-hidden app-main-scroll relative z-0", (location === '/dika' || location === '/dika-web') && "lg:flex lg:flex-col")}>
        <PullIndicator />
        <div className={cn(`p-4 md:p-8 max-w-[1800px] mx-auto md:pb-8 md:pt-0 ${isDikaWithKeyboard ? '' : 'mobile-content-bottom'} ${location === '/dika' || location === '/dika-web' ? '' : 'mobile-safe-top'}`, location === '/dika' && "lg:flex-1 lg:overflow-hidden lg:p-0", location === '/dika-web' && "lg:flex-1 lg:overflow-hidden !p-0 !max-w-none")}>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar - frosted glass, fixed at bottom */}
      <nav 
        className={cn("md:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-200 glass-tab-bar", isDikaWithKeyboard && "translate-y-full")}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex justify-around items-center w-full h-14">
          {primaryTabs.map((item) => {
            const isActive = location === item.href || 
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div 
                  className={`relative flex flex-col items-center gap-0.5 min-w-[56px] cursor-pointer transition-all duration-200 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  data-testid={`tab-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className={`relative flex items-center justify-center w-10 h-7 rounded-full transition-all duration-300 ${isActive ? "bg-primary/12 dark:bg-primary/20" : ""}`}>
                    <item.icon className={`w-[18px] h-[18px] transition-all duration-200 ${isActive ? "stroke-[2.5] scale-110" : ""}`} />
                    {(item.badge ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
                        {(item.badge ?? 0) > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] leading-tight truncate max-w-[60px] ${isActive ? "font-semibold" : "font-normal opacity-60"}`}>{item.label}</span>
                </div>
              </Link>
            );
          })}
          {hasMoreMenu && (
            <div 
              className="relative flex flex-col items-center gap-0.5 min-w-[56px] cursor-pointer transition-colors text-muted-foreground"
              onClick={() => setMoreMenuOpen(true)}
              data-testid="tab-more"
            >
              <div className="relative flex items-center justify-center w-10 h-7 rounded-full">
                <Menu className="w-[18px] h-[18px]" />
                {secondaryBadgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
                    {secondaryBadgeCount > 99 ? '99+' : secondaryBadgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight font-normal opacity-60">More</span>
            </div>
          )}
        </div>
      </nav>

      {/* More Menu Drawer - polished with grouped sections */}
      <Drawer open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
        <DrawerContent className="bg-background/95 backdrop-blur-xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
          <DrawerHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl shadow-lg shadow-primary/25 overflow-hidden flex items-center justify-center ring-2 ring-primary/10">
                  <img src={ogymLogo} alt="OGym" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-lg magic-text">OGym</span>
                    <div className="flex items-center gap-1 px-1.5 pr-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800/80 border border-amber-500/20">
                      <div className="w-4 h-4 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <RoboDIcon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-[9px] font-mono font-bold tracking-wider text-amber-600 dark:text-amber-400 uppercase">AI</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{user.username} &middot; <span className="capitalize">{user.role}</span></p>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </DrawerHeader>
          <div className="px-4 max-h-[50vh] overflow-y-auto space-y-4">
            {secondaryTabs.length > 0 && (
              <div className="space-y-1">
                {secondaryTabs.map((item) => {
                  const isActive = location === item.href || 
                    (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <div 
                      key={item.href}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                          : "text-foreground hover:bg-secondary/80 active:scale-[0.98]"
                      }`}
                      onClick={() => {
                        navigate(item.href);
                        setMoreMenuOpen(false);
                      }}
                      data-testid={`more-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? "bg-white/20" : "bg-muted/60"}`}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      {(item.badge ?? 0) > 0 && (
                        <Badge 
                          variant="secondary" 
                          className={`text-[10px] px-1.5 min-w-[20px] ${isActive ? "bg-white/20 text-primary-foreground" : "bg-primary text-primary-foreground"}`}
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-4 pt-3 pb-4 border-t border-border/30 mt-3 flex-shrink-0">
            <div 
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-all duration-200"
              onClick={() => {
                setMoreMenuOpen(false);
                logoutMutation.mutate();
              }}
              data-testid="more-sign-out"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-destructive/10">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">Sign Out</span>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

    </div>
  );
}
