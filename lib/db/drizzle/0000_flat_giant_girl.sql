CREATE TYPE "public"."language" AS ENUM('ar', 'en');--> statement-breakpoint
CREATE TYPE "public"."teacher_tier" AS ENUM('free', 'bronze', 'golden', 'diamond');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'teacher', 'admin');--> statement-breakpoint
CREATE TYPE "public"."course_status" AS ENUM('draft', 'pending_review', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."lesson_type" AS ENUM('video', 'text', 'quiz');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('multiple_choice', 'true_false', 'short_answer');--> statement-breakpoint
CREATE TYPE "public"."quiz_type" AS ENUM('lesson', 'final');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'live', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'cash', 'mobile_wallet', 'wallet', 'redeem_card');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."earnings_status" AS ENUM('pending', 'available', 'paid');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('wrong_content', 'offensive', 'technical_issue', 'no_show', 'inappropriate_behavior', 'copyright', 'spam', 'stolen_identity', 'stolen_material', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'under_review', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('lesson', 'session', 'teacher', 'course', 'tutoring_misbehave');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('hosting', 'domain', 'marketing', 'salary', 'tools', 'other');--> statement-breakpoint
CREATE TYPE "public"."tutoring_status" AS ENUM('pending', 'accepted', 'declined', 'completed', 'cancelled', 'cancelled_no_show', 'rescheduled_by_teacher', 'rescheduled_by_student', 'completed_pending_review', 'approved', 'rejected', 'partially_approved', 'terminated_due_to_report');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tutoring_listing_status" AS ENUM('active', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."ad_status" AS ENUM('pending', 'active', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ad_type" AS ENUM('homepage_banner', 'search_boost');--> statement-breakpoint
CREATE TYPE "public"."verification_job_status" AS ENUM('pending', 'processing', 'matched', 'no_match', 'failed');--> statement-breakpoint
CREATE TYPE "public"."verification_job_type" AS ENUM('face', 'voice', 'duplicate_video', 'audio_moderation');--> statement-breakpoint
CREATE TYPE "public"."complaint_status" AS ENUM('open', 'investigating', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."analytics_event_type" AS ENUM('profile_view', 'share_click', 'course_impression', 'ad_click', 'ad_impression');--> statement-breakpoint
CREATE TYPE "public"."academy_application_status" AS ENUM('pending', 'approved', 'rejected', 'waitlisted');--> statement-breakpoint
CREATE TYPE "public"."academy_enrollment_status" AS ENUM('active', 'suspended', 'completed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."academy_program_type" AS ENUM('primary', 'preparatory', 'secondary_scientific', 'secondary_literary');--> statement-breakpoint
CREATE TYPE "public"."academy_registration_status" AS ENUM('registered', 'in_progress', 'completed', 'failed', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."parent_relationship" AS ENUM('parent', 'guardian', 'learning_coach');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('new_course', 'live_session_starting', 'live_session_cancelled', 'system_alert');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."prepaid_card_status" AS ENUM('active', 'used', 'expired');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"full_name_ar" varchar(255),
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"avatar_url" text,
	"bio" text,
	"bio_ar" text,
	"expertise" text,
	"language" "language" DEFAULT 'ar' NOT NULL,
	"phone_number" varchar(20),
	"phone_verified" boolean DEFAULT false NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"otp_code" varchar(6),
	"otp_expiry" timestamp,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_tutoring_enabled" boolean DEFAULT false NOT NULL,
	"tutoring_hourly_rate" numeric(10, 2) DEFAULT '0',
	"tutoring_subjects" text,
	"tutoring_levels" text,
	"commission_agreed" boolean DEFAULT false NOT NULL,
	"tutoring_suspended_until" timestamp,
	"cv_url" text,
	"face_photo_url" text,
	"voice_sample_url" text,
	"copyright_agreed_at" timestamp,
	"profile_slug" varchar(255),
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"biometric_profile" text,
	"biometrics_verified" boolean DEFAULT false NOT NULL,
	"tier" "teacher_tier" DEFAULT 'free' NOT NULL,
	"pro_expiry" timestamp,
	"storage_used" bigint DEFAULT 0 NOT NULL,
	"is_bonus_unlocked" boolean DEFAULT false NOT NULL,
	"is_sponsored" boolean DEFAULT false NOT NULL,
	"sponsored_until" timestamp,
	"balance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"passkey_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_profile_slug_unique" UNIQUE("profile_slug")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_ar" varchar(100) NOT NULL,
	"icon" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"title_ar" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"description_ar" text NOT NULL,
	"thumbnail_url" text,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'LYD' NOT NULL,
	"level" "level" DEFAULT 'beginner' NOT NULL,
	"language" varchar(5) DEFAULT 'ar' NOT NULL,
	"category_id" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"status" "course_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"submitted_at" timestamp,
	"reviewed_at" timestamp,
	"reviewed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"title_ar" varchar(255) NOT NULL,
	"description" text,
	"description_ar" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"section_id" integer,
	"title" varchar(255) NOT NULL,
	"title_ar" varchar(255) NOT NULL,
	"video_url" text,
	"video_file_path" text,
	"video_public_id" text,
	"document_file_path" text,
	"document_file_name" varchar(255),
	"document_public_id" text,
	"content" text,
	"content_ar" text,
	"notes" text,
	"notes_ar" text,
	"duration" integer DEFAULT 0 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"type" "lesson_type" DEFAULT 'video' NOT NULL,
	"book_name" varchar(255),
	"book_name_ar" varchar(255),
	"school_year" varchar(50),
	"chapter" varchar(100),
	"page_number" varchar(50),
	"subject_tags" text,
	"video_fingerprint" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slides" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"title_ar" varchar(255),
	"content" text,
	"content_ar" text,
	"image_url" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"quiz_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"earned_points" integer DEFAULT 0 NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"answers" text,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"text" text NOT NULL,
	"text_ar" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"quiz_id" integer NOT NULL,
	"question" text NOT NULL,
	"question_ar" text NOT NULL,
	"type" "question_type" DEFAULT 'multiple_choice' NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"explanation" text,
	"explanation_ar" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"lesson_id" integer,
	"title" varchar(255) NOT NULL,
	"title_ar" varchar(255) NOT NULL,
	"description" text,
	"description_ar" text,
	"type" "quiz_type" DEFAULT 'lesson' NOT NULL,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"time_limit_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"progress" numeric(5, 2) DEFAULT '0' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"watched_seconds" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer,
	"teacher_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"title_ar" varchar(255) NOT NULL,
	"description" text,
	"scheduled_at" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"max_participants" integer DEFAULT 100 NOT NULL,
	"meeting_url" text,
	"recording_url" text,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cancellation_reason" text,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"course_id" integer,
	"session_id" integer,
	"tutoring_request_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'LYD' NOT NULL,
	"method" "payment_method" DEFAULT 'bank_transfer' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"reference" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_earnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"payment_id" integer NOT NULL,
	"course_id" integer,
	"session_id" integer,
	"tutoring_request_id" integer,
	"gross_amount" numeric(10, 2) NOT NULL,
	"platform_fee_percent" numeric(5, 2) DEFAULT '20' NOT NULL,
	"platform_fee" numeric(10, 2) NOT NULL,
	"net_amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'LYD' NOT NULL,
	"status" "earnings_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'LYD' NOT NULL,
	"payment_method" varchar(50) DEFAULT 'bank_transfer' NOT NULL,
	"details" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp,
	"left_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" integer NOT NULL,
	"reported_user_id" integer,
	"type" "report_type" NOT NULL,
	"reason" "report_reason" NOT NULL,
	"description" text,
	"target_id" integer,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"admin_note" text,
	"recording_url" text,
	"resolved_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"lesson_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'LYD' NOT NULL,
	"category" "expense_category" DEFAULT 'other' NOT NULL,
	"notes" text,
	"expense_date" timestamp DEFAULT now() NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutoring_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"teacher_id" integer,
	"category_id" integer,
	"subject" varchar(255) NOT NULL,
	"topic" text NOT NULL,
	"lecturer_level" varchar(100),
	"education_type" varchar(50),
	"is_urgent" boolean DEFAULT false NOT NULL,
	"attachments_url" text,
	"preferred_at" timestamp NOT NULL,
	"proposed_at" timestamp,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"message" text,
	"hourly_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'LYD' NOT NULL,
	"status" "tutoring_status" DEFAULT 'pending' NOT NULL,
	"meeting_url" text,
	"recording_url" text,
	"payment_id" integer,
	"student_rating" integer,
	"student_review" text,
	"admin_review" text,
	"session_started_at" timestamp,
	"timer_paused_at" timestamp,
	"elapsed_seconds" integer DEFAULT 0 NOT NULL,
	"teacher_left_at" timestamp,
	"student_left_at" timestamp,
	"early_termination_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutoring_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"message" text,
	"preferred_at" timestamp,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"teacher_note" text,
	"meeting_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutoring_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"title_ar" varchar(255) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"subject_ar" varchar(100) NOT NULL,
	"grade_level" varchar(100),
	"grade_level_ar" varchar(100),
	"description" text,
	"description_ar" text,
	"hourly_rate" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'LYD' NOT NULL,
	"max_students" integer DEFAULT 1 NOT NULL,
	"available_days" text,
	"available_time_from" varchar(10),
	"available_time_to" varchar(10),
	"session_duration_minutes" integer DEFAULT 60 NOT NULL,
	"status" "tutoring_listing_status" DEFAULT 'active' NOT NULL,
	"total_applications" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"question" text NOT NULL,
	"answered" boolean DEFAULT false NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" varchar(500) NOT NULL,
	"description" varchar(500),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "advertisements" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"ad_type" "ad_type" NOT NULL,
	"status" "ad_status" DEFAULT 'pending' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"budget_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'LYD' NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"payment_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_verification_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"lesson_id" integer,
	"job_type" "verification_job_type" NOT NULL,
	"status" "verification_job_status" DEFAULT 'pending' NOT NULL,
	"match_score" numeric(5, 2),
	"duplicate_of_lesson_id" integer,
	"admin_notes" text,
	"reviewed_by_admin_id" integer,
	"flagged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copyright_complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_name" varchar(255) NOT NULL,
	"reporter_email" varchar(255) NOT NULL,
	"reporter_user_id" integer,
	"reported_teacher_id" integer NOT NULL,
	"reported_lesson_id" integer,
	"description" text NOT NULL,
	"proof_url" text,
	"status" "complaint_status" DEFAULT 'open' NOT NULL,
	"admin_notes" text,
	"resolved_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"event_type" "analytics_event_type" NOT NULL,
	"referer" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_endorsements" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"trait" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"device_fingerprint" varchar(255) NOT NULL,
	"device_name" varchar(255),
	"last_ip" varchar(45),
	"user_agent" text,
	"is_trusted" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"program_id" integer NOT NULL,
	"status" "academy_application_status" DEFAULT 'pending' NOT NULL,
	"grade_level" varchar(50) NOT NULL,
	"previous_school" varchar(255),
	"previous_school_ar" varchar(255),
	"documents_url" text,
	"parent_name" varchar(255),
	"parent_name_ar" varchar(255),
	"parent_phone" varchar(20),
	"parent_email" varchar(255),
	"notes" text,
	"reviewed_by" integer,
	"review_notes" text,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"program_id" integer NOT NULL,
	"semester_id" integer NOT NULL,
	"application_id" integer,
	"status" "academy_enrollment_status" DEFAULT 'active' NOT NULL,
	"current_grade_level" varchar(50) NOT NULL,
	"gpa" numeric(4, 2),
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_parent_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_user_id" integer NOT NULL,
	"student_user_id" integer NOT NULL,
	"relationship" "parent_relationship" DEFAULT 'parent' NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"name_ar" varchar(255) NOT NULL,
	"description" text,
	"description_ar" text,
	"type" "academy_program_type" NOT NULL,
	"grade_level" varchar(50) NOT NULL,
	"duration_years" integer DEFAULT 1 NOT NULL,
	"tuition_per_semester" numeric(10, 2) DEFAULT '0',
	"currency" varchar(10) DEFAULT 'LYD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"semester_id" integer NOT NULL,
	"grade" numeric(5, 2),
	"status" "academy_registration_status" DEFAULT 'registered' NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_semesters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"name_ar" varchar(255) NOT NULL,
	"program_id" integer NOT NULL,
	"academic_year" varchar(20) NOT NULL,
	"semester_number" integer DEFAULT 1 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"name_ar" varchar(255) NOT NULL,
	"description" text,
	"description_ar" text,
	"program_id" integer NOT NULL,
	"grade_level" varchar(50) NOT NULL,
	"semester_number" integer DEFAULT 1 NOT NULL,
	"credit_hours" integer DEFAULT 3 NOT NULL,
	"prerequisite_subject_id" integer,
	"teacher_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redeem_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"redeemed_by" integer,
	"redeemed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deactivated_at" timestamp,
	CONSTRAINT "redeem_cards_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"title_ar" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"message_ar" text NOT NULL,
	"reference_id" integer,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"device_type" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"reference_type" varchar(100),
	"reference_id" integer,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prepaid_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"status" "prepaid_card_status" DEFAULT 'active' NOT NULL,
	"used_by" integer,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prepaid_cards_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50),
	"target_id" integer,
	"details" jsonb,
	"ip" varchar(60),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_session_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"content_rating" integer NOT NULL,
	"technical_rating" integer,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uniq_live_feedback_user_session" UNIQUE("session_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slides" ADD CONSTRAINT "slides_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tutoring_request_id_tutoring_requests_id_fk" FOREIGN KEY ("tutoring_request_id") REFERENCES "public"."tutoring_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_earnings" ADD CONSTRAINT "teacher_earnings_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_registrations" ADD CONSTRAINT "session_registrations_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_registrations" ADD CONSTRAINT "session_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_requests" ADD CONSTRAINT "tutoring_requests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_requests" ADD CONSTRAINT "tutoring_requests_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_requests" ADD CONSTRAINT "tutoring_requests_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_applications" ADD CONSTRAINT "tutoring_applications_listing_id_tutoring_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."tutoring_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_applications" ADD CONSTRAINT "tutoring_applications_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_listings" ADD CONSTRAINT "tutoring_listings_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_verification_jobs" ADD CONSTRAINT "content_verification_jobs_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_verification_jobs" ADD CONSTRAINT "content_verification_jobs_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_verification_jobs" ADD CONSTRAINT "content_verification_jobs_duplicate_of_lesson_id_lessons_id_fk" FOREIGN KEY ("duplicate_of_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_verification_jobs" ADD CONSTRAINT "content_verification_jobs_reviewed_by_admin_id_users_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_complaints" ADD CONSTRAINT "copyright_complaints_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_complaints" ADD CONSTRAINT "copyright_complaints_reported_teacher_id_users_id_fk" FOREIGN KEY ("reported_teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_complaints" ADD CONSTRAINT "copyright_complaints_reported_lesson_id_lessons_id_fk" FOREIGN KEY ("reported_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_complaints" ADD CONSTRAINT "copyright_complaints_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_analytics" ADD CONSTRAINT "profile_analytics_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_endorsements" ADD CONSTRAINT "student_endorsements_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_endorsements" ADD CONSTRAINT "student_endorsements_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_devices" ADD CONSTRAINT "teacher_devices_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_applications" ADD CONSTRAINT "academy_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_applications" ADD CONSTRAINT "academy_applications_program_id_academy_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."academy_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_applications" ADD CONSTRAINT "academy_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_enrollments" ADD CONSTRAINT "academy_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_enrollments" ADD CONSTRAINT "academy_enrollments_program_id_academy_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."academy_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_enrollments" ADD CONSTRAINT "academy_enrollments_semester_id_academy_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."academy_semesters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_enrollments" ADD CONSTRAINT "academy_enrollments_application_id_academy_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."academy_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_parent_links" ADD CONSTRAINT "academy_parent_links_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_parent_links" ADD CONSTRAINT "academy_parent_links_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_registrations" ADD CONSTRAINT "academy_registrations_enrollment_id_academy_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."academy_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_registrations" ADD CONSTRAINT "academy_registrations_subject_id_academy_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academy_subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_registrations" ADD CONSTRAINT "academy_registrations_semester_id_academy_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."academy_semesters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_semesters" ADD CONSTRAINT "academy_semesters_program_id_academy_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."academy_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_subjects" ADD CONSTRAINT "academy_subjects_program_id_academy_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."academy_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_subjects" ADD CONSTRAINT "academy_subjects_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeem_cards" ADD CONSTRAINT "redeem_cards_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_push_tokens" ADD CONSTRAINT "user_push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_cards" ADD CONSTRAINT "prepaid_cards_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_session_feedback" ADD CONSTRAINT "live_session_feedback_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_session_feedback" ADD CONSTRAINT "live_session_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_session_feedback" ADD CONSTRAINT "live_session_feedback_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;