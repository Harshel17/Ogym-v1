import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Loader2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

type Announcement = {
  id: number;
  gymId: number;
  title: string;
  body: string;
  audience: "members" | "trainers" | "everyone";
  createdByOwnerId: number;
  createdAt: string;
  isRead: boolean;
};

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"]
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/announcements/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements/unread-count"] });
    }
  });

  useEffect(() => {
    announcements.forEach(a => {
      if (!a.isRead) {
        markReadMutation.mutate(a.id);
      }
    });
  }, [announcements]);

  const getAudienceBadge = (audience: string) => {
    switch (audience) {
      case "members":
        return <Badge variant="outline" className="text-blue-600 border-blue-300">Members</Badge>;
      case "trainers":
        return <Badge variant="outline" className="text-purple-600 border-purple-300">Trainers</Badge>;
      default:
        return <Badge variant="outline" className="text-green-600 border-green-300">Everyone</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">Announcements</h2>
        <p className="text-muted-foreground mt-1">Stay updated with news from your gym</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No announcements</p>
            <p className="text-muted-foreground mt-1">Check back later for updates from your gym</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id} data-testid={`announcement-${announcement.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-lg">{announcement.title}</CardTitle>
                    {getAudienceBadge(announcement.audience)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(announcement.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{announcement.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
