function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton-premium ${className}`} />;
}

export function OwnerDashboardSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid gap-3 grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-8 w-8 rounded-lg" />
            </div>
            <SkeletonBlock className="h-7 w-16" />
            <SkeletonBlock className="h-2.5 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border p-4 space-y-3">
        <SkeletonBlock className="h-5 w-32" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBlock className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <SkeletonBlock className="h-3.5 w-28" />
                <SkeletonBlock className="h-2.5 w-20" />
              </div>
              <SkeletonBlock className="h-6 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border p-4 space-y-3">
        <SkeletonBlock className="h-5 w-40" />
        <SkeletonBlock className="h-32 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function TrainerDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-8 w-8 rounded-lg" />
            </div>
            <SkeletonBlock className="h-7 w-12" />
            <SkeletonBlock className="h-2.5 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-5 w-5 rounded" />
          <SkeletonBlock className="h-5 w-44" />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <SkeletonBlock className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MemberDashboardSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border p-3 space-y-2 text-center">
            <SkeletonBlock className="h-6 w-10 mx-auto" />
            <SkeletonBlock className="h-2.5 w-16 mx-auto" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
          <SkeletonBlock className="h-2 w-full rounded-full" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <SkeletonBlock className="h-9 w-9 rounded-lg" />
                  <div className="space-y-1">
                    <SkeletonBlock className="h-3.5 w-28" />
                    <SkeletonBlock className="h-2.5 w-20" />
                  </div>
                </div>
                <SkeletonBlock className="h-8 w-8 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-4 space-y-2">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-6 w-20" />
          <SkeletonBlock className="h-1.5 w-full rounded-full" />
        </div>
        <div className="rounded-xl border border-border p-4 space-y-2">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-6 w-20" />
          <SkeletonBlock className="h-1.5 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
