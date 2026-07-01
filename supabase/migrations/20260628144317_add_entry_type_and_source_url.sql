DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reading_entries' AND column_name = 'entry_type'
  ) THEN
    ALTER TABLE reading_entries ADD COLUMN entry_type text NOT NULL DEFAULT 'book';
    ALTER TABLE reading_entries ADD CONSTRAINT reading_entries_entry_type_check CHECK (entry_type IN ('book', 'article'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'source_url'
  ) THEN
    ALTER TABLE books ADD COLUMN source_url text;
  END IF;
END $$;
