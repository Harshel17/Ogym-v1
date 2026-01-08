-- Production readiness: Add critical performance indexes for OGym
-- These indexes improve query performance for common access patterns at scale

CREATE INDEX IF NOT EXISTS attendance_gym_date_idx ON attendance(gym_id, date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS attendance_member_date_idx ON attendance(member_id, date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS workout_completions_member_date_idx ON workout_completions(member_id, completed_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS workout_completions_gym_date_idx ON workout_completions(gym_id, completed_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payments_gym_updated_at_idx ON payments(gym_id, updated_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS feed_posts_gym_created_at_idx ON feed_posts(gym_id, created_at);
