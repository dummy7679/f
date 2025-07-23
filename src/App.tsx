import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Header } from './components/Layout/Header';
import { HomePage } from './components/Home/HomePage';
import { CreateMeeting } from './components/Meeting/CreateMeeting';
import { JoinMeeting } from './components/Meeting/JoinMeeting';
import { MeetingRoom } from './components/Meeting/MeetingRoom';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={
            <>
              <Header />
              <HomePage />
            </>
          } />
          <Route path="/create-meeting" element={
            <>
              <Header />
              <CreateMeeting />
            </>
          } />
          <Route path="/join/:meetingCode" element={
            <>
              <Header />
              <JoinMeeting />
            </>
          } />
          <Route path="/join" element={
            <>
              <Header />
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Meeting Link</h1>
                  <p className="text-gray-600 mb-8">Please check your meeting code and try again.</p>
                  <Navigate to="/" replace />
                </div>
              </div>
            </>
          } />
          
          {/* Meeting room */}
          <Route path="/meeting/:meetingCode" element={<MeetingRoom />} />
          <Route path="/meeting" element={
            <div className="h-screen bg-gray-900 flex items-center justify-center">
              <div className="text-center text-white">
                <h1 className="text-2xl font-bold mb-4">Meeting Not Found</h1>
                <p className="mb-8">Please check your meeting code and try again.</p>
                <Navigate to="/" replace />
              </div>
            </div>
          } />
          
          {/* Catch all - redirect to home */}
          <Route path="*" element={
            <>
              <Header />
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
                  <p className="text-gray-600 mb-8">The page you're looking for doesn't exist.</p>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all"
                  >
                    Go Home
                  </button>
                </div>
              </div>
            </>
          } />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;