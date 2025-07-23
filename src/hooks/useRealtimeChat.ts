import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ChatMessage {
  id: string;
  meeting_id: string;
  sender_id?: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export function useRealtimeChat(meetingId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meetingId) return;

    // Fetch existing messages
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`meeting-chat-${meetingId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `meeting_id=eq.${meetingId}`
        }, 
        (payload) => {
          setMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [meetingId]);

  const sendMessage = async (content: string, senderName: string, senderId?: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          meeting_id: meetingId,
          sender_id: senderId || null,
          sender_name: senderName,
          content: content.trim(),
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  };

  return {
    messages,
    loading,
    sendMessage,
  };
}