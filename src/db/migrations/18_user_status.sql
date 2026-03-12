-- Add status and deactivated_at to public.users
-- status: 'pending' (awaiting admin approval), 'active' (approved), 'deactivated' (disabled)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'deactivated'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- All existing users were created before the approval system existed — mark them active
UPDATE public.users SET status = 'active' WHERE status = 'pending';
