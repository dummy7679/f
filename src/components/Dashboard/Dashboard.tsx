import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Users, Plus, Video, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  is_private: boolean;
  access_code: string;
  created_at: string;
}

export function Dashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    initializeUser();
  }, []);

  const initializeUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        fetchMeetings(user.id);
        fetchUserProfile(user.id);
      }
    } catch (error) {
      console.error('Error initializing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchMeetings = async (userId: string) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('host_name', userProfile?.full_name || '')
        .order('start_time', { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast.error('Failed to load meetings');
    }
  };

  const copyMeetingLink = (accessCode: string) => {
    const meetingLink = `${window.location.origin}/join/${accessCode}`;
    navigator.clipboard.writeText(meetingLink);
    toast.success('Meeting link copied to clipboard!');
  };

  const upcomingMeetings = meetings.filter(meeting => 
    new Date(meeting.start_time) > new Date()
  );

  const pastMeetings = meetings.filter(meeting => 
    new Date(meeting.start_time) <= new Date()
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {userProfile?.full_name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your meetings and collaborate with your team
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            to="/create-meeting"
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-2xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">New Meeting</h3>
                <p className="text-blue-100">Start or schedule a meeting</p>
              </div>
            </div>
          </Link>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">
                  {upcomingMeetings.length}
                </h3>
                <p className="text-gray-600">Upcoming meetings</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">
                  {pastMeetings.length}
                </h3>
                <p className="text-gray-600">Past meetings</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Meetings */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Upcoming Meetings</h2>
            <Link
              to="/create-meeting"
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Schedule new
            </Link>
          </div>

          {upcomingMeetings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming meetings</h3>
              <p className="text-gray-600 mb-6">Schedule your first meeting to get started</p>
              <Link
                to="/create-meeting"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all gap-2"
              >
                <Plus className="w-4 h-4" />
                Schedule Meeting
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMeetings.slice(0, 3).map((meeting) => (
                <div
                  key={meeting.id}
                  className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {meeting.title}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(meeting.start_time), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{format(new Date(meeting.start_time), 'hh:mm a')}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>{meeting.is_private ? 'Private' : 'Public'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => copyMeetingLink(meeting.access_code)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Copy meeting link"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <Link
                        to={`/meeting/${meeting.access_code}`}
                        className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all gap-2"
                      >
                        <Video className="w-4 h-4" />
                        Join
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Meetings */}
        {pastMeetings.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Meetings</h2>
            <div className="space-y-4">
              {pastMeetings.slice(0, 5).map((meeting) => (
                <div
                  key={meeting.id}
                  className="bg-white rounded-2xl border border-gray-200 p-6 opacity-75"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {meeting.title}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(meeting.start_time), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{format(new Date(meeting.start_time), 'hh:mm a')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Completed
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}