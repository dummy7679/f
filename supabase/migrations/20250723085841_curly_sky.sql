/*
  # Initial Database Schema for Metstack

  1. New Tables
    - `meetings`
      - `id` (uuid, primary key)
      - `title` (text)
      - `host_name` (text)
      - `start_time` (timestamp)
      - `end_time` (timestamp, nullable)
      - `is_private` (boolean)
      - `access_code` (text, unique)
      - `created_at` (timestamp)
    
    - `participants`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key)
      - `name` (text)
      - `user_id` (uuid, nullable)
      - `joined_at` (timestamp)
      - `left_at` (timestamp, nullable)
    
    - `messages`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key)
      - `sender_id` (uuid, nullable)
      - `sender_name` (text)
      - `content` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (since this is a demo app)
*/

-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  host_name text NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  is_private boolean DEFAULT false,
  access_code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  name text NOT NULL,
  user_id uuid,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  sender_id uuid,
  sender_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (demo purposes)
CREATE POLICY "Allow all operations on meetings"
  ON meetings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on participants"
  ON participants
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on messages"
  ON messages
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meetings_access_code ON meetings(access_code);
CREATE INDEX IF NOT EXISTS idx_participants_meeting_id ON participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_messages_meeting_id ON messages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);