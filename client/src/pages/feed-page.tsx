import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeed, useFeedComments, useAddReaction, useRemoveReaction, useAddComment, useHidePost, type FeedPost } from "@/hooks/use-social";
import { useAuth } from "@/hooks/use-auth";
import { Heart, Flame, Award, HandMetal, MessageCircle, MoreHorizontal, Send, Dumbbell, Trophy, UserPlus, Sparkles } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const reactionIcons: Record<string, typeof Heart> = {
  like: Heart,
  fire: Flame,
  muscle: Dumbbell,
  clap: HandMetal,
};

const postTypeIcons: Record<string, typeof Dumbbell> = {
  workout_complete: Dumbbell,
  streak_milestone: Trophy,
  new_member: UserPlus,
  achievement: Award,
  manual: Sparkles,
};

function PostCard({ post }: { post: FeedPost }) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  
  const { data: comments, isLoading: commentsLoading } = useFeedComments(showComments ? post.id : 0);
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();
  const addComment = useAddComment();
  const hidePost = useHidePost();
  
  const userReaction = post.reactions.find(r => r.userId === user?.id);
  const reactionCounts = post.reactions.reduce((acc, r) => {
    acc[r.reactionType] = (acc[r.reactionType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const handleReaction = (type: string) => {
    if (userReaction?.reactionType === type) {
      removeReaction.mutate(post.id);
    } else {
      addReaction.mutate({ postId: post.id, reactionType: type });
    }
  };
  
  const handleComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate({ postId: post.id, content: commentText });
    setCommentText("");
  };
  
  const PostIcon = postTypeIcons[post.type] || Sparkles;
  
  const getPostContent = () => {
    if (post.content) return post.content;
    
    const meta = post.metadata ? JSON.parse(post.metadata) : {};
    
    switch (post.type) {
      case "workout_complete":
        return `Completed ${meta.exerciseCount || 0} exercises today!`;
      case "streak_milestone":
        return `Reached a ${meta.streakDays || 0} day streak!`;
      case "new_member":
        return "Just joined the gym!";
      case "achievement":
        return meta.achievement || "Earned a new achievement!";
      default:
        return "Shared an update";
    }
  };
  
  const canModerate = user?.role === "owner" || user?.role === "trainer";
  
  return (
    <Card data-testid={`card-feed-post-${post.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{post.user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium" data-testid={`text-post-username-${post.id}`}>{post.user.username}</p>
            <p className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <PostIcon className="h-3 w-3" />
            {post.type.replace("_", " ")}
          </Badge>
          {canModerate && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-post-menu-${post.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => hidePost.mutate(post.id)} data-testid={`button-hide-post-${post.id}`}>
                  Hide post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-lg" data-testid={`text-post-content-${post.id}`}>{getPostContent()}</p>
        
        <div className="flex items-center gap-2 flex-wrap">
          {(["like", "fire", "muscle", "clap"] as const).map((type) => {
            const Icon = reactionIcons[type];
            const count = reactionCounts[type] || 0;
            const isActive = userReaction?.reactionType === type;
            
            return (
              <Button
                key={type}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handleReaction(type)}
                className="gap-1"
                data-testid={`button-react-${type}-${post.id}`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "fill-current" : ""}`} />
                {count > 0 && <span>{count}</span>}
              </Button>
            );
          })}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="gap-1 ml-auto"
            data-testid={`button-comments-${post.id}`}
          >
            <MessageCircle className="h-4 w-4" />
            {post.commentCount > 0 && <span>{post.commentCount}</span>}
          </Button>
        </div>
        
        {showComments && (
          <div className="space-y-3 pt-2 border-t">
            {commentsLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              comments?.map((comment) => (
                <div key={comment.id} className="flex gap-2" data-testid={`card-comment-${comment.id}`}>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{comment.user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-muted rounded-lg p-2">
                    <p className="text-sm font-medium">{comment.user.username}</p>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                </div>
              ))
            )}
            
            <div className="flex gap-2">
              <Input
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
                data-testid={`input-comment-${post.id}`}
              />
              <Button size="icon" onClick={handleComment} disabled={!commentText.trim() || addComment.isPending} data-testid={`button-send-comment-${post.id}`}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FeedPage() {
  const { data: posts, isLoading } = useFeed();
  
  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold">Gym Feed</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }
  
  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Gym Feed</h1>
      </div>
      
      {(!posts || posts.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No activity yet</h3>
            <p className="text-muted-foreground">Complete workouts to see updates here!</p>
          </CardContent>
        </Card>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))
      )}
    </div>
  );
}
