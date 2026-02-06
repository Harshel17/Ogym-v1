function SkeletonBlock({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div 
      className={`skeleton-premium ${className}`} 
      style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    />
  );
}

export function OwnerDashboardSkeleton() {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="grid gap-2.5 grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-3 w-20" delay={i * 50} />
              <SkeletonBlock className="h-8 w-8 rounded-lg" delay={i * 50 + 25} />
            </div>
            <SkeletonBlock className="h-7 w-16" delay={i * 75} />
            <SkeletonBlock className="h-2.5 w-24" delay={i * 100} />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border p-4 space-y-3">
        <SkeletonBlock className="h-5 w-32" delay={250} />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBlock className="h-8 w-8 rounded-full" delay={300 + i * 50} />
              <div className="flex-1 space-y-1">
                <SkeletonBlock className="h-3.5 w-28" delay={300 + i * 75} />
                <SkeletonBlock className="h-2.5 w-20" delay={300 + i * 100} />
              </div>
              <SkeletonBlock className="h-6 w-14 rounded-full" delay={300 + i * 50} />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border p-4 space-y-3">
        <SkeletonBlock className="h-5 w-40" delay={500} />
        <SkeletonBlock className="h-32 w-full rounded-lg" delay={550} />
      </div>
    </div>
  );
}

export function TrainerDashboardSkeleton() {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="grid gap-2.5 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-3 w-24" delay={i * 50} />
              <SkeletonBlock className="h-8 w-8 rounded-lg" delay={i * 75} />
            </div>
            <SkeletonBlock className="h-7 w-12" delay={i * 100} />
            <SkeletonBlock className="h-2.5 w-32" delay={i * 125} />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-5 w-5 rounded" delay={200} />
          <SkeletonBlock className="h-5 w-44" delay={225} />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <SkeletonBlock className="h-10 w-10 rounded-full" delay={250 + i * 50} />
            <div className="flex-1 space-y-1">
              <SkeletonBlock className="h-4 w-32" delay={275 + i * 50} />
              <SkeletonBlock className="h-3 w-24" delay={300 + i * 50} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MemberDashboardSkeleton() {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-10 w-10 rounded-xl" delay={50} />
              <div className="space-y-1">
                <SkeletonBlock className="h-5 w-36" delay={75} />
                <SkeletonBlock className="h-3 w-24" delay={100} />
              </div>
            </div>
            <SkeletonBlock className="h-6 w-20 rounded-full" delay={125} />
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <SkeletonBlock className="h-9 w-9 rounded-lg" delay={150 + i * 50} />
                  <div className="space-y-1">
                    <SkeletonBlock className="h-3.5 w-28" delay={175 + i * 50} />
                    <SkeletonBlock className="h-2.5 w-20" delay={200 + i * 50} />
                  </div>
                </div>
                <SkeletonBlock className="h-8 w-8 rounded-full" delay={175 + i * 75} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-border p-4 space-y-2">
          <SkeletonBlock className="h-10 w-10 rounded-full mx-auto" delay={400} />
          <SkeletonBlock className="h-6 w-12 mx-auto" delay={450} />
          <SkeletonBlock className="h-3 w-16 mx-auto" delay={475} />
        </div>
        <div className="rounded-xl border border-border p-4 space-y-2">
          <SkeletonBlock className="h-10 w-10 rounded-full mx-auto" delay={425} />
          <SkeletonBlock className="h-6 w-12 mx-auto" delay={475} />
          <SkeletonBlock className="h-3 w-16 mx-auto" delay={500} />
        </div>
      </div>
    </div>
  );
}
