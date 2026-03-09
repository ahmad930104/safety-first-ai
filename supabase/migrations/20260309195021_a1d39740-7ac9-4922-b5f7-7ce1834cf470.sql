
-- Create violations table to store safety violations
CREATE TABLE public.violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_description TEXT,
  missing_gear TEXT[] NOT NULL DEFAULT '{}',
  photo_url TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high',
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;

-- Allow public read/insert for now (no auth required for FYP demo)
CREATE POLICY "Anyone can view violations" ON public.violations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert violations" ON public.violations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete violations" ON public.violations FOR DELETE USING (true);

-- Create storage bucket for violation photos
INSERT INTO storage.buckets (id, name, public) VALUES ('violation-photos', 'violation-photos', true);

-- Storage policies
CREATE POLICY "Violation photos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'violation-photos');
CREATE POLICY "Anyone can upload violation photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'violation-photos');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
