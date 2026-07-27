/*
# Convert "Article" entry type to "Audiobook"

## Summary
This migration replaces the "article" entry type with "audiobook" across the database.
The reading log app now supports books and audiobooks (instead of books and articles).

## Changes

### 1. New column: books.narrator
- `narrator` (text, nullable) — stores the audiobook narrator name (e.g. "Julia Whelan").
- Only used when the linked reading entry is of type 'audiobook'.

### 2. Recreate CHECK constraint on reading_entries.entry_type
- The existing constraint `reading_entries_entry_type_check` allowed ('book', 'article').
- We drop it first, then recreate it to allow ('book', 'audiobook') instead.
- The constraint is dropped BEFORE the data update so existing 'article' rows can be
  migrated to 'audiobook' without violating the old constraint.

### 3. Migrate existing article entries to audiobook
- All `reading_entries.entry_type = 'article'` rows are updated to 'audiobook'.
- This preserves the original entries; no data is lost — only the type label changes.

## Security
- No RLS or policy changes. Existing policies on reading_entries and books remain unchanged.
- The new `narrator` column inherits the table's existing RLS policies automatically.

## Important notes
1. The constraint name `reading_entries_entry_type_check` is preserved (dropped then recreated) so existing tooling that references it still works.
2. The constraint is dropped BEFORE the data update so the UPDATE does not violate the old ('book', 'article') check.
3. The `narrator` column is nullable because it is only relevant for audiobook entries; book entries leave it null.
*/

-- 1. Add narrator column to books (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'narrator'
  ) THEN
    ALTER TABLE books ADD COLUMN narrator text;
  END IF;
END $$;

-- 2. Drop the old CHECK constraint BEFORE updating rows, so the UPDATE does not violate it
ALTER TABLE reading_entries DROP CONSTRAINT IF EXISTS reading_entries_entry_type_check;

-- 3. Migrate existing 'article' entries to 'audiobook'
UPDATE reading_entries
SET entry_type = 'audiobook'
WHERE entry_type = 'article';

-- 4. Recreate the CHECK constraint with 'audiobook' instead of 'article'
ALTER TABLE reading_entries ADD CONSTRAINT reading_entries_entry_type_check
  CHECK (entry_type IN ('book', 'audiobook'));
