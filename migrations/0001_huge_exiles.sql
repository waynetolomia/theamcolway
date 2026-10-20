CREATE TABLE `academy_submissions` (
	`user_id` text NOT NULL,
	`journey_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`document` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `journey_id`, `activity_id`)
);
