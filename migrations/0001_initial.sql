CREATE TABLE `enquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`service` text NOT NULL,
	`budget` text NOT NULL,
	`timeline` text NOT NULL,
	`message` text NOT NULL,
	`consent_version` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enquiries_reference_unique` ON `enquiries` (`reference`);--> statement-breakpoint
CREATE INDEX `enquiries_email_created_idx` ON `enquiries` (`email`,`created_at`);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY NOT NULL, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE INDEX rate_limits_reset_idx ON rate_limits(reset_at);
