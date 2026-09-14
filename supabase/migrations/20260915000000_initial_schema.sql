-- Migration: Initial Schema for Crossword PWA
-- Fixes schema drift by establishing correct column names matching the frontend codebase.

-- 1. Create Tables

CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    display_name TEXT NOT NULL
);

CREATE TABLE public.puzzles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    puzzle_type TEXT NOT NULL CHECK (puzzle_type IN ('standard', 'custom')),
    order_index INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    grid TEXT[] NOT NULL,
    clues JSONB NOT NULL
);

CREATE TABLE public.puzzle_progress (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    puzzle_id TEXT REFERENCES public.puzzles(id) ON DELETE CASCADE,
    cell_state TEXT[] NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    solve_time_seconds INTEGER,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, puzzle_id)
);

-- 2. Enable Row Level Security (RLS)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_progress ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Profiles: Users can read and update their own profile
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Puzzles: All authenticated users can view puzzles, but cannot modify them
CREATE POLICY "Authenticated users can view puzzles" 
    ON public.puzzles FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Puzzle Progress: Users can read and write only their own progress
CREATE POLICY "Users can view own progress" 
    ON public.puzzle_progress FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" 
    ON public.puzzle_progress FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" 
    ON public.puzzle_progress FOR UPDATE 
    USING (auth.uid() = user_id);

-- Optional: Function to automatically update the updated_at timestamp if modified outside the app
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Wait, the app explicitly passes updated_at for optimistic locking compare-and-swap, 
-- so a database trigger that auto-updates it could actually break the frontend logic 
-- if the frontend expects to set it precisely. We will NOT add a trigger for updated_at here.
