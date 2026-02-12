import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeed, useFeedComments, useAddReaction, useRemoveReaction, useAddComment, useHidePost, useCreatePost, useReportPost, useBlockUser, useBlockedUsers, type FeedPost } from "@/hooks/use-social";
import { useAuth } from "@/hooks/use-auth";
import { Heart, Flame, Award, HandMetal, MessageCircle, MoreHorizontal, Send, Dumbbell, Trophy, UserPlus, Sparkles, Flag, UserX, Activity } from "lucide-react";
import { GuidedEmptyState } from "@/components/guided-empty-state";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
  const reportPost = useReportPost();
  const blockUser = useBlockUser();
  
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
          {post.userId !== user?.id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-post-menu-${post.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {canModerate && (
                  <>
                    <DropdownMenuItem onClick={() => hidePost.mutate(post.id)} data-testid={`button-hide-post-${post.id}`}>
                      Hide post
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger data-testid={`button-report-post-${post.id}`}>
                    <Flag className="h-4 w-4 mr-2" />
                    Report post
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => reportPost.mutate({ postId: post.id, reason: "inappropriate" })} data-testid={`button-report-inappropriate-${post.id}`}>
                      Inappropriate content
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => reportPost.mutate({ postId: post.id, reason: "spam" })} data-testid={`button-report-spam-${post.id}`}>
                      Spam
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => reportPost.mutate({ postId: post.id, reason: "harassment" })} data-testid={`button-report-harassment-${post.id}`}>
                      Harassment
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => reportPost.mutate({ postId: post.id, reason: "other" })} data-testid={`button-report-other-${post.id}`}>
                      Other
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem 
                  onClick={() => blockUser.mutate(post.userId)} 
                  data-testid={`button-block-user-${post.id}`}
                  className="text-destructive"
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Block user
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
  const { data: blockedUsers = [] } = useBlockedUsers();
  const [postContent, setPostContent] = useState("");
  const createPost = useCreatePost();
  
  // Filter out posts from blocked users
  const filteredPosts = posts?.filter(post => !blockedUsers.includes(post.userId));
  
  const handleCreatePost = () => {
    if (!postContent.trim()) return;
    createPost.mutate(postContent, {
      onSuccess: () => setPostContent("")
    });
  };
  
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
    <div className="container max-w-2xl mx-auto p-4 space-y-4 stagger-list">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Gym Feed</h1>
      </div>
      
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Share an update with your gym..."
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePost()}
              maxLength={500}
              data-testid="input-create-post"
            />
            <Button onClick={handleCreatePost} disabled={!postContent.trim() || createPost.isPending} data-testid="button-create-post">
              <Send className="h-4 w-4 mr-2" />
              Post
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {(!filteredPosts || filteredPosts.length === 0) ? (
        <GuidedEmptyState
          icon={Activity}
          title="No Activity Yet"
          description="When you or your gym mates complete workouts, achievements will show up here."
          features={[
            "Celebrate workout completions and streaks",
            "React and comment on achievements",
            "Stay motivated with your gym community"
          ]}
          actionLabel="Start a Workout"
          actionHref="/"
          iconGradient="from-orange-500 to-rose-500"
        />
      ) : (
        filteredPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))
      )}
    </div>
  );
}
