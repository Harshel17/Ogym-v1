import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, type LucideIcon } from "lucide-react";

interface GuidedEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  features?: string[];
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  gradient?: string;
  iconGradient?: string;
}

export function GuidedEmptyState({
  icon: Icon,
  title,
  description,
  features,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  gradient = "from-primary/5 to-primary/10",
  iconGradient = "from-primary to-indigo-600",
}: GuidedEmptyStateProps) {
  return (
    <Card className="border-0 bg-gradient-to-br from-muted/30 to-muted/10 overflow-visible" data-testid="guided-empty-state">
      <CardContent className="py-8 px-6">
        <div className="flex flex-col items-center text-center max-w-sm mx-auto">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${iconGradient} flex items-center justify-center mb-4 shadow-lg shadow-primary/20`}>
            <Icon className="w-8 h-8 text-white" />
          </div>

          <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-title">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4" data-testid="text-empty-description">{description}</p>

          {features && features.length > 0 && (
            <div className={`w-full rounded-xl bg-gradient-to-br ${gradient} p-4 mb-5`}>
              <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2.5">What you can do</p>
              <ul className="space-y-2 text-left">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 w-full">
            {actionLabel && actionHref && (
              <Link href={actionHref}>
                <Button className="w-full" data-testid="button-empty-action">
                  {actionLabel}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
            {actionLabel && onAction && !actionHref && (
              <Button className="w-full" onClick={onAction} data-testid="button-empty-action">
                {actionLabel}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {secondaryActionLabel && secondaryActionHref && (
              <Link href={secondaryActionHref}>
                <Button variant="ghost" size="sm" className="w-full text-xs" data-testid="button-empty-secondary">
                  {secondaryActionLabel}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
