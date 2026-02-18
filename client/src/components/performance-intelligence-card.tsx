import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RoboDIcon } from "@/components/dika/dika-icons";
import { isNative, isIOS } from "@/lib/capacitor-init";
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Dumbbell,
  Heart,
  Utensils,
  Scale,
  CalendarCheck,
  CreditCard,
  Users,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Brain,
  Lightbulb,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";

interface ReportSection {
  title: string;
  icon: string;
  value: string;
  detail?: string;
}

interface IntelligenceReport {
  role: "member" | "owner" | "trainer";
  period: string;
  generatedAt: string;
  sections: ReportSection[];
  patterns: string[];
  projection: string;
  adjustment: string;
  narrative: string;
}

const iconMap: Record<string, any> = {
  "trending-up": TrendingUp,
  "dumbbell": Dumbbell,
  "heart": Heart,
  "utensils": Utensils,
  "scale": Scale,
  "calendar-check": CalendarCheck,
  "credit-card": CreditCard,
  "users": Users,
  "check-circle": CheckCircle2,
  "alert-triangle": AlertTriangle,
};

export function PerformanceIntelligenceCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  if (isNative() && isIOS()) {
    return null;
  }

  const { data: report, isLoading, error, refetch } = useQuery<IntelligenceReport>({
    queryKey: ["/api/intelligence-report"],
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const handleDikaFollowUp = () => {
    const prompt = encodeURIComponent(
      report
        ? `I just saw my Performance Intelligence Report. ${report.narrative} Can you go deeper into my stats and help me understand what I should focus on this week?`
        : "Tell me about my recent performance and what I should improve"
    );
    setLocation(`/dika?prompt=${prompt}`);
  };

  return (
    <Card
      className="border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden"
      data-testid="performance-intelligence-card"
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-3 hover:bg-primary/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base" data-testid="intelligence-card-title">
                    Performance Intelligence
                  </CardTitle>
                  {report && !isOpen && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1" data-testid="intelligence-card-preview">
                      {report.narrative}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {report && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {report.period}
                  </Badge>
                )}
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8" data-testid="intelligence-loading">
                <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground">Analyzing your data...</span>
              </div>
            ) : error ? (
              <div className="text-center py-6 space-y-2" data-testid="intelligence-error">
                <p className="text-sm text-muted-foreground">Could not load your intelligence report right now.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="intelligence-retry">
                  Try again
                </Button>
              </div>
            ) : report ? (
              <>
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/10" data-testid="intelligence-narrative">
                  <p className="text-sm leading-relaxed">{report.narrative}</p>
                </div>

                <div className="grid gap-2.5" data-testid="intelligence-sections">
                  {report.sections.map((section, i) => {
                    const IconComp = iconMap[section.icon] || TrendingUp;
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-2.5 rounded-lg bg-card border"
                        data-testid={`intelligence-section-${i}`}
                      >
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <IconComp className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">{section.title}</span>
                          </div>
                          <p className="text-sm font-semibold mt-0.5" data-testid={`section-value-${i}`}>
                            {section.value}
                          </p>
                          {section.detail && (
                            <p className="text-xs text-muted-foreground mt-0.5">{section.detail}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {report.patterns.length > 0 && (
                  <div className="space-y-2" data-testid="intelligence-patterns">
                    <div className="flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Pattern Observations
                      </span>
                    </div>
                    {report.patterns.map((pattern, i) => (
                      <div key={i} className="flex items-start gap-2 pl-1">
                        <span className="text-xs text-primary font-bold mt-0.5">{i + 1}.</span>
                        <p className="text-sm">{pattern}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2" data-testid="intelligence-projection">
                  <div className="flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Forward Projection
                    </span>
                  </div>
                  <p className="text-sm pl-1">{report.projection}</p>
                </div>

                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3" data-testid="intelligence-adjustment">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                      This Week's Adjustment
                    </span>
                  </div>
                  <p className="text-sm text-green-800 dark:text-green-200">{report.adjustment}</p>
                </div>

                <Button
                  variant="outline"
                  className="w-full gap-2 border-primary/20 hover:bg-primary/5"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDikaFollowUp();
                  }}
                  data-testid="intelligence-dika-followup"
                >
                  <RoboDIcon className="w-4 h-4 text-primary" />
                  <span className="text-sm">Ask Dika about this report</span>
                </Button>
              </>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground" data-testid="intelligence-empty">
                Unable to generate report. Try again later.
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
