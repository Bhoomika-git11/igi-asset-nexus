
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS s_no INT,
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS cpu_make TEXT,
  ADD COLUMN IF NOT EXISTS cpu_model TEXT,
  ADD COLUMN IF NOT EXISTS cpu_serial TEXT,
  ADD COLUMN IF NOT EXISTS printer_make TEXT,
  ADD COLUMN IF NOT EXISTS printer_model TEXT,
  ADD COLUMN IF NOT EXISTS printer_serial TEXT,
  ADD COLUMN IF NOT EXISTS scanner_make TEXT,
  ADD COLUMN IF NOT EXISTS scanner_model TEXT,
  ADD COLUMN IF NOT EXISTS scanner_serial TEXT,
  ADD COLUMN IF NOT EXISTS ups_make_model TEXT,
  ADD COLUMN IF NOT EXISTS ups_serial TEXT,
  ADD COLUMN IF NOT EXISTS windows_os TEXT,
  ADD COLUMN IF NOT EXISTS status_text TEXT,
  ADD COLUMN IF NOT EXISTS source_sheet TEXT,
  ADD COLUMN IF NOT EXISTS sub_assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.inventory(id) ON DELETE CASCADE;

ALTER TABLE public.inventory ALTER COLUMN asset_tag DROP NOT NULL;

CREATE INDEX IF NOT EXISTS inv_parent_idx ON public.inventory(parent_id);
CREATE INDEX IF NOT EXISTS inv_source_sheet_idx ON public.inventory(source_sheet);
CREATE INDEX IF NOT EXISTS inv_designation_idx ON public.inventory(designation);
