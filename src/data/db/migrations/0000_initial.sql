-- MemoEZ initial schema
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS `notes` (
  `id`          INTEGER PRIMARY KEY AUTOINCREMENT,
  `title`       TEXT    NOT NULL DEFAULT '',
  `content`     TEXT    NOT NULL DEFAULT '',
  `type`        TEXT    NOT NULL DEFAULT 'TEXT'   CHECK(`type`  IN ('TEXT','CHECKLIST')),
  `color`       TEXT    NOT NULL DEFAULT 'NONE'   CHECK(`color` IN ('NONE','RED','ORANGE','YELLOW','GREEN','TEAL','BLUE','PURPLE')),
  `is_pinned`   INTEGER NOT NULL DEFAULT 0,
  `is_archived` INTEGER NOT NULL DEFAULT 0,
  `sort_weight` REAL    NOT NULL DEFAULT 0,
  `created_at`  INTEGER NOT NULL,
  `updated_at`  INTEGER NOT NULL,
  `deleted_at`  INTEGER,
  `server_id`   TEXT,
  `synced_at`   INTEGER
);

CREATE INDEX IF NOT EXISTS `idx_notes_updated_at`
  ON `notes` (`updated_at` DESC);
CREATE INDEX IF NOT EXISTS `idx_notes_is_pinned`
  ON `notes` (`is_pinned` DESC, `sort_weight` DESC);

CREATE TABLE IF NOT EXISTS `checklist_items` (
  `id`         INTEGER PRIMARY KEY AUTOINCREMENT,
  `note_id`    INTEGER NOT NULL REFERENCES `notes`(`id`) ON DELETE CASCADE,
  `text`       TEXT    NOT NULL DEFAULT '',
  `is_checked` INTEGER NOT NULL DEFAULT 0,
  `position`   INTEGER NOT NULL DEFAULT 0,
  `created_at` INTEGER NOT NULL,
  `deleted_at` INTEGER
);

CREATE INDEX IF NOT EXISTS `idx_checklist_note_id`
  ON `checklist_items` (`note_id`, `position` ASC);

CREATE TABLE IF NOT EXISTS `labels` (
  `id`         INTEGER PRIMARY KEY AUTOINCREMENT,
  `name`       TEXT    NOT NULL,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  `deleted_at` INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS `idx_labels_name`
  ON `labels` (`name`) WHERE `deleted_at` IS NULL;

CREATE TABLE IF NOT EXISTS `note_labels` (
  `note_id`  INTEGER NOT NULL REFERENCES `notes`(`id`)  ON DELETE CASCADE,
  `label_id` INTEGER NOT NULL REFERENCES `labels`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`note_id`, `label_id`)
);

CREATE INDEX IF NOT EXISTS `idx_note_labels_label_id`
  ON `note_labels` (`label_id`);
