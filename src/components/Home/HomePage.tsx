import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, Users, Shield, Clock, Play, ChevronRight } from 'lucide-react';

export function HomePage() {
  const [meetingCode, setMeetingCode] = useState('');
  const navigate = useNavigate();

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (meetingCode.trim()) {
      navigate(`/join/${meetingCode.trim()}`);
    }
  };

  const features = [
    {
      icon: Video,
      title: 'HD Video Calls',
      description: 'Crystal clear video conferencing with advanced audio processing'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Real-time chat, screen sharing, and interactive whiteboard'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'End-to-end encryption with enterprise-grade security'
    },
    {
      icon: Clock,
      title: 'Schedule Meetings',
      description: 'Plan ahead with meeting scheduling and calendar integration'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Connect, Collaborate,{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Create
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Experience seamless video meetings with real-time collaboration tools. 
              Host, join, and manage meetings with enterprise-grade security.
            </p>

            {/* Join Meeting Form */}
            <div className="max-w-md mx-auto mb-12">
              <form onSubmit={handleJoinMeeting} className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Enter meeting code"
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  className="flex-1 px-6 py-4 text-lg border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="submit"
                  className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Join
                </button>
              </form>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/create-meeting"
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <Video className="w-5 h-5" />
                Create Meeting
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-4000"></div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything you need for productive meetings
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built for teams of all sizes with enterprise-grade features and security
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="text-center p-8 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:shadow-lg transition-all transform hover:-translate-y-1"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="text-white">
              <div className="text-5xl font-bold mb-2">10M+</div>
              <div className="text-xl opacity-90">Meetings Hosted</div>
            </div>
            <div className="text-white">
              <div className="text-5xl font-bold mb-2">50K+</div>
              <div className="text-xl opacity-90">Active Users</div>
            </div>
            <div className="text-white">
              <div className="text-5xl font-bold mb-2">99.9%</div>
              <div className="text-xl opacity-90">Uptime</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Ready to transform your meetings?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of teams already using Metstack for their daily collaboration
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 gap-2"
          >
            Start Free Today
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Developer Credits */}
      <div className="py-12 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">
              Development by
            </p>
            <div className="flex items-center justify-center space-x-2">
              <span className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Aftabstack
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600 font-medium">
                Aftab Alam
              </span>
            </div>
            <div className="mt-2">
              <a
                href="https://instagram.com/aftabxplained"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                @aftabxplained
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}