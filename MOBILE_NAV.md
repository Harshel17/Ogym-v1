# OGym Mobile Navigation Implementation

## Overview

This document describes the responsive navigation behavior for OGym V1, covering desktop sidebar and mobile bottom tab bar implementations.

---

## Responsive Navigation Behavior

### Desktop (>=768px)
- **Left Sidebar**: Fixed 256px width sidebar with full navigation menu
- **Bottom Tab Bar**: Hidden
- **Content Area**: Full width minus sidebar, standard padding (32px)

### Mobile (<768px)
- **Left Sidebar**: Hidden completely
- **Top Header**: Sticky header with logo, theme toggle, and logout
- **Bottom Tab Bar**: Fixed at bottom with safe-area support
- **Content Area**: Full width with bottom padding to prevent overlap

---

## Bottom Tab Bar Configuration

### Safe-Area Styling
```css
/* Tab bar height includes safe area */
height: calc(72px + env(safe-area-inset-bottom));
padding-bottom: env(safe-area-inset-bottom);

/* Content padding to prevent overlap */
padding-bottom: calc(72px + env(safe-area-inset-bottom));
```

### Role-Based Tabs (3-5 tabs per role)

#### Owner (with gym) - 5 tabs
| Tab | Icon | Route |
|-----|------|-------|
| Dashboard | LayoutDashboard | `/` |
| Members | Users | `/members` |
| Attendance | CalendarCheck | `/owner/attendance` |
| Payments | CreditCard | `/payments` |
| Profile | UserCircle | `/profile` |

#### Owner (without gym) - 3 tabs
| Tab | Icon | Route |
|-----|------|-------|
| Register | Building2 | `/gym-request` |
| Support | HelpCircle | `/support` |
| Profile | UserCircle | `/profile` |

#### Trainer - 5 tabs
| Tab | Icon | Route | Badge |
|-----|------|-------|-------|
| Dashboard | LayoutDashboard | `/` | - |
| Workouts | Dumbbell | `/workouts` | - |
| Members | Users | `/members` | - |
| Requests | MessageSquare | `/requests` | Pending count |
| Profile | UserCircle | `/profile` | - |

#### Member (with gym) - 5 tabs
| Tab | Icon | Route |
|-----|------|-------|
| Dashboard | LayoutDashboard | `/` |
| Workout | Dumbbell | `/my-workout` |
| Attendance | CalendarCheck | `/attendance` |
| Progress | TrendingUp | `/progress` |
| Profile | UserCircle | `/profile` |

#### Member (without gym) - 3 tabs
| Tab | Icon | Route |
|-----|------|-------|
| Join Gym | Building2 | `/join-gym` |
| Support | HelpCircle | `/support` |
| Profile | UserCircle | `/profile` |

### Active Tab Highlighting
- Active tab: `text-primary` color, bold font weight, thicker icon stroke
- Inactive tab: `text-muted-foreground` color
- Route matching: Exact match for `/`, prefix match for other routes

---

## Layout Structure

```tsx
<div className="min-h-screen bg-secondary/30 flex">
  {/* Desktop Sidebar - hidden on mobile */}
  <aside className="w-64 hidden md:flex ...">
    {/* Full navigation menu */}
  </aside>

  {/* Main Content */}
  <main className="flex-1 min-w-0 overflow-auto">
    {/* Mobile Header - hidden on desktop */}
    <header className="md:hidden sticky top-0 ...">
      {/* Logo, theme toggle, logout */}
    </header>
    
    {/* Page Content with mobile bottom padding */}
    <div className="p-4 md:p-8 pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-8">
      {children}
    </div>
  </main>

  {/* Mobile Bottom Tab Bar - hidden on desktop */}
  <nav className="md:hidden fixed bottom-0 left-0 right-0 ...">
    {/* 5 role-based tabs */}
  </nav>
</div>
```

---

## Mobile Layout Requirements

### Cards and Grids
All dashboard grids use responsive breakpoints:
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
  {/* Single column on mobile, 2 on tablet, 5 on desktop */}
</div>
```

### Charts
All charts use Recharts `ResponsiveContainer` which adapts to container width:
```tsx
<ResponsiveContainer width="100%" height="100%">
  <BarChart data={data}>...</BarChart>
</ResponsiveContainer>
```

### Buttons
Buttons use size variants from shadcn/ui, no custom width/height needed.
Full-width buttons on mobile achieved via:
```tsx
<Button className="w-full md:w-auto">
```

---

## Verified Breakpoints

| Width | Device | Status |
|-------|--------|--------|
| 320px | iPhone SE | Single column, bottom tabs visible |
| 375px | iPhone 8/SE | Single column, bottom tabs visible |
| 390px | iPhone 12/13/14 | Single column, bottom tabs visible |
| 428px | iPhone 14 Pro Max | Single column, bottom tabs visible |
| 768px | iPad Mini (portrait) | Sidebar visible, bottom tabs hidden |
| 1024px | iPad (landscape) | Full desktop layout |

---

## Key Files

| File | Description |
|------|-------------|
| `client/src/components/layout.tsx` | Main layout with sidebar and bottom tabs |
| `client/src/hooks/use-mobile.tsx` | Mobile breakpoint hook (768px) |
| `client/src/pages/dashboard-page.tsx` | Dashboard with responsive grids/charts |

---

## Testing Checklist

### Mobile (< 768px)
- [ ] Sidebar is completely hidden
- [ ] Bottom tab bar is visible with 5 tabs
- [ ] Content does not scroll under bottom tab bar
- [ ] Active tab is highlighted correctly
- [ ] Tapping tab navigates to correct route
- [ ] Cards stack in single column
- [ ] No horizontal scrolling on any page
- [ ] Safe area padding works on iPhone X+

### Desktop (>= 768px)
- [ ] Sidebar is visible on left
- [ ] Bottom tab bar is hidden
- [ ] All navigation items accessible in sidebar
- [ ] Grids use multi-column layouts

### Cross-Role Testing
- [ ] Owner (with gym) sees correct 5 tabs (Dashboard, Members, Attendance, Payments, Profile)
- [ ] Owner (without gym) sees correct 3 tabs (Register, Support, Profile)
- [ ] Trainer sees correct 5 tabs (Dashboard, Workouts, Members, Requests, Profile)
- [ ] Member (with gym) sees correct 5 tabs (Dashboard, Workout, Attendance, Progress, Profile)
- [ ] Member (without gym) sees correct 3 tabs (Join Gym, Support, Profile)
- [ ] Badge on Trainer's Requests tab shows pending count

---

## Implementation Notes

1. **Breakpoint**: 768px (`md:` Tailwind prefix) is the mobile/desktop cutoff
2. **Tab Height**: 72px content area + safe-area-inset-bottom
3. **Content Padding**: Matches tab bar height to prevent overlap
4. **Icon Size**: 24x24px (w-6 h-6) for better touch targets
5. **Label Size**: 11px font for readability without crowding

---

## Accessibility

- All tabs have `data-testid` attributes for testing
- Icons paired with text labels for clarity
- Touch targets meet 44px minimum (tab items have padding)
- Active state uses both color and font weight for visibility
