/*
+  # Create meetings and messages tables for Metstack
+
+  1. New Tables
+    - `meetings`
+      - `id` (uuid, primary key)
+      - `title` (text)
+      - `host_name` (text)
+      - `start_time` (timestamp)
+      - `end_time` (timestamp, nullable)
+      - `is_private` (boolean)
+      - `access_code` (text, unique)
+      - `created_at` (timestamp)
+    - `participants`
+      - `id` (uuid, primary key)
+      - `user_id` (uuid, nullable)
+      - `meeting_id` (uuid, foreign key)
+      - `name` (text)
+      - `joined_at` (timestamp)
+      - `left_at` (timestamp, nullable)
+    - `messages`
+      - `id` (uuid, primary key)
+      - `meeting_id` (uuid, foreign key)
+      - `sender_id` (uuid, nullable)
+      - `sender_name` (text)
+      - `content` (text)
+      - `created_at` (timestamp)
+
+  2. Security
+    - Enable RLS on all tables
+    - Add policies for public access (no authentication required)
+*/
+
+-- Create meetings table
+CREATE TABLE IF NOT EXISTS meetings (
+  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  title text NOT NULL,
+  host_name text NOT NULL,
+  start_time timestamptz DEFAULT now(),
+  end_time timestamptz,
+  is_private boolean DEFAULT false,
+  access_code text UNIQUE NOT NULL,
+  created_at timestamptz DEFAULT now()
+);
+
+-- Create participants table
+CREATE TABLE IF NOT EXISTS participants (
+  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  user_id uuid,
+  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
+  name text NOT NULL,
+  joined_at timestamptz DEFAULT now(),
+  left_at timestamptz
+);
+
+-- Create messages table
+CREATE TABLE IF NOT EXISTS messages (
+  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
+  sender_id uuid,
+  sender_name text NOT NULL,
+  content text NOT NULL,
+  created_at timestamptz DEFAULT now()
+);
+
+-- Enable RLS
+ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
+ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
+ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
+
+-- Policies for meetings (public access)
+CREATE POLICY "Anyone can read meetings"
+  ON meetings
+  FOR SELECT
+  TO anon, authenticated
+  USING (true);
+
+CREATE POLICY "Anyone can create meetings"
+  ON meetings
+  FOR INSERT
+  TO anon, authenticated
+  WITH CHECK (true);
+
+-- Policies for participants (public access)
+CREATE POLICY "Anyone can read participants"
+  ON participants
+  FOR SELECT
+  TO anon, authenticated
+  USING (true);
+
+CREATE POLICY "Anyone can create participants"
+  ON participants
+  FOR INSERT
+  TO anon, authenticated
+  WITH CHECK (true);
+
+-- Policies for messages (public access)
+CREATE POLICY "Anyone can read messages"
+  ON messages
+  FOR SELECT
+  TO anon, authenticated
+  USING (true);
+
+CREATE POLICY "Anyone can create messages"
+  ON messages
+  FOR INSERT
+  TO anon, authenticated
+  WITH CHECK (true);
+
+-- Add indexes for better performance
+CREATE INDEX IF NOT EXISTS meetings_access_code_idx ON meetings(access_code);
+CREATE INDEX IF NOT EXISTS participants_meeting_id_idx ON participants(meeting_id);
+CREATE INDEX IF NOT EXISTS messages_meeting_id_idx ON messages(meeting_id);
+CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
+