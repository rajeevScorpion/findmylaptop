CREATE TABLE IF NOT EXISTS public.courses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category              TEXT NOT NULL,
  name                  TEXT NOT NULL UNIQUE,
  workload_level        TEXT NOT NULL CHECK (workload_level IN ('light', 'balanced', 'heavy')),
  recommended_cpu       TEXT,
  recommended_gpu       TEXT,
  recommended_ram       TEXT,
  recommended_storage   TEXT,
  recommended_display   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
