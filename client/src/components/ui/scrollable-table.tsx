import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface ScrollableTableWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollableTableWrapper({ children, className }: ScrollableTableWrapperProps) {
  const [showScrollHint, setShowScrollHint] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const hasHorizontalScroll = container.scrollWidth > container.clientWidth;
      const isScrolledToEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
      setShowScrollHint(hasHorizontalScroll && !isScrolledToEnd);
    };

    checkScroll();
    container.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    return () => {
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [children]);

  return (
    <div className="relative">
      <div 
        ref={containerRef}
        className={cn("overflow-x-auto", className)}
      >
        {children}
      </div>
      {showScrollHint && (
        <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none flex items-center justify-center bg-gradient-to-l from-background/90 to-transparent md:hidden">
          <ChevronRight className="w-4 h-4 text-muted-foreground animate-pulse" />
        </div>
      )}
    </div>
  );
}
