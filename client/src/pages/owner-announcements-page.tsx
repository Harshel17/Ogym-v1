import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Megaphone, Plus, Trash2, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Announcement = {
  id: number;
  gymId: number;
  title: string;
  body: string;
  audience: "members" | "trainers" | "everyone";
  createdByOwnerId: number;
  createdAt: string;
};

const announcementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Message is required"),
  audience: z.enum(["members", "trainers", "everyone"])
});

type AnnouncementForm = z.infer<typeof announcementSchema>;

export default function OwnerAnnouncementsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<AnnouncementForm>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: "",
      body: "",
      audience: "everyone"
    }
  });

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/owner/announcements"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: AnnouncementForm) => {
      return apiRequest("POST", "/api/owner/announcements", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/announcements"] });
      form.reset();
      setIsOpen(false);
      toast({ title: "Announcement published" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to publish", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/owner/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/announcements"] });
      toast({ title: "Announcement deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    }
  });

  const onSubmit = (data: AnnouncementForm) => {
    createMutation.mutate(data);
  };

  const getAudienceBadge = (audience: string) => {
    switch (audience) {
      case "members":
        return <Badge className="bg-blue-500">Members Only</Badge>;
      case "trainers":
        return <Badge className="bg-purple-500">Trainers Only</Badge>;
      default:
        return <Badge className="bg-green-500">Everyone</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">Announcements</h2>
          <p className="text-muted-foreground mt-1">Create and manage gym announcements</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-announcement">
              <Plus className="w-4 h-4 mr-2" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Announcement title" {...field} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Announcement message" {...field} data-testid="input-body" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="audience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Audience</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-audience">
                            <SelectValue placeholder="Select audience" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="everyone">Everyone</SelectItem>
                          <SelectItem value="members">Members Only</SelectItem>
                          <SelectItem value="trainers">Trainers Only</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createMutation.isPending}
                  data-testid="button-publish"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Megaphone className="h-4 w-4 mr-2" />
                  )}
                  Publish Announcement
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No announcements yet</p>
            <p className="text-muted-foreground mt-1">Create your first announcement to notify members and trainers</p>
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
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => deleteMutation.mutate(announcement.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${announcement.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
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
