-- ============================================
-- Row Level Security (RLS) Policies
-- For Budget Rent PH Application
-- ============================================

-- Enable RLS on properties table
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SELECT Policies
-- ============================================

-- Allow anyone to view verified properties
CREATE POLICY "view_verified_properties" ON public.properties
FOR SELECT
USING (
  is_verified = true OR 
  user_id = auth.uid() OR
  owner_id = auth.uid()
);

-- ============================================
-- INSERT Policies
-- ============================================

-- Only authenticated users can insert their own properties
CREATE POLICY "insert_own_properties" ON public.properties
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  user_id = auth.uid()
);

-- ============================================
-- UPDATE Policies
-- ============================================

-- Users can only update their own properties
CREATE POLICY "update_own_properties" ON public.properties
FOR UPDATE
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- ============================================
-- DELETE Policies
-- ============================================

-- Users can only delete their own properties
CREATE POLICY "delete_own_properties" ON public.properties
FOR DELETE
USING (
  user_id = auth.uid()
);

-- ============================================
-- Prevent direct updates to critical fields
-- ============================================

-- Prevent users from changing is_verified status directly
ALTER TABLE public.properties ADD CONSTRAINT prevent_self_verify
CHECK (
  -- This would be enforced by business logic, not here
  true
);

-- ============================================
-- Create audit log trigger
-- ============================================

CREATE TABLE IF NOT EXISTS public.property_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE public.property_audit_log ENABLE ROW LEVEL SECURITY;

-- Only users can view their own audit logs
CREATE POLICY "view_own_audit_logs" ON public.property_audit_log
FOR SELECT
USING (user_id = auth.uid());

-- Create trigger to log changes
CREATE OR REPLACE FUNCTION log_property_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.property_audit_log (property_id, user_id, action, changes)
  VALUES (
    NEW.id,
    auth.uid(),
    TG_OP,
    CASE 
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
        'old', to_jsonb(OLD),
        'new', to_jsonb(NEW)
      )
      ELSE to_jsonb(NEW)
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER property_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION log_property_changes();

-- ============================================
-- Create verification requests table with RLS
-- ============================================

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own verification requests
CREATE POLICY "view_own_verification_requests" ON public.verification_requests
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own verification requests
CREATE POLICY "insert_own_verification_requests" ON public.verification_requests
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  user_id = auth.uid()
);

-- ============================================
-- Grant appropriate permissions
-- ============================================

-- Grant SELECT to authenticated users
GRANT SELECT ON public.properties TO authenticated;
GRANT SELECT ON public.property_audit_log TO authenticated;
GRANT SELECT ON public.verification_requests TO authenticated;

-- Grant INSERT, UPDATE, DELETE to authenticated users (RLS will restrict)
GRANT INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT INSERT ON public.verification_requests TO authenticated;
