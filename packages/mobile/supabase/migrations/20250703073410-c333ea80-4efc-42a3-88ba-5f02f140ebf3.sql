-- Create storage bucket for G-code files
INSERT INTO storage.buckets (id, name, public) VALUES ('gcode-files', 'gcode-files', false);

-- Create policies for G-code file access
CREATE POLICY "Users can view their own G-code files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'gcode-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own G-code files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'gcode-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own G-code files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'gcode-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own G-code files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'gcode-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create a table to track G-code files metadata
CREATE TABLE public.gcode_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  print_time_estimate INTEGER,
  filament_estimate REAL,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'printing', 'completed', 'failed'))
);

-- Enable RLS on gcode_files table
ALTER TABLE public.gcode_files ENABLE ROW LEVEL SECURITY;

-- Create policies for gcode_files table
CREATE POLICY "Users can view their own G-code files metadata" 
ON public.gcode_files 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own G-code files metadata" 
ON public.gcode_files 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own G-code files metadata" 
ON public.gcode_files 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own G-code files metadata" 
ON public.gcode_files 
FOR DELETE 
USING (auth.uid() = user_id);