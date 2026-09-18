-- Migration: Add author_name and congrats_message to puzzles table
ALTER TABLE public.puzzles
ADD COLUMN author_name TEXT,
ADD COLUMN congrats_message TEXT;
