import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PersonalInfo from "./pages/Personal-info";
import AuthCallback from "./pages/AuthCallback";
import Mfa from "./pages/Mfa";
import ProtectedRoute from "./routes/ProtectedRoute";
import Home from "./pages/Home";
import AddActivity from "./pages/AddActivity";
import ActivityDetails from "./pages/ActivityDetails";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Search from "./pages/Search";
import UserProfile from "./pages/UserProfile";
import Chat from "./pages/Chat";
import ChatThread from "./pages/ChatThread";
import ApiDocs from "./pages/ApiDocs";
import Training from "./pages/Training";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import { supabase } from "./supabaseClient";
import { getChatSocket, disconnectChatSocket } from "./chat/socket";

function App() {
  useEffect(() => {
    let connected = false

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !connected) {
        connected = true
        void getChatSocket().catch(() => {})
      } else if (!session && connected) {
        connected = false
        disconnectChatSocket()
      }
    })

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session && !connected) {
        connected = true
        void getChatSocket().catch(() => {})
      }
    }).catch(() => {})

    return () => {
      sub?.subscription?.unsubscribe()
    }
  }, [])

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/mfa" element={<Mfa />} />
        <Route
          path="/activities/new"
          element={
            <ProtectedRoute>
              <AddActivity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activities/:id"
          element={
            <ProtectedRoute>
              <ActivityDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/personal-info"
          element={
            <ProtectedRoute>
              <PersonalInfo />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <Search />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users/:id"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat/:id"
          element={
            <ProtectedRoute>
              <ChatThread />
            </ProtectedRoute>
          }
        />

        <Route
          path="/training"
          element={
            <ProtectedRoute>
              <Training />
            </ProtectedRoute>
          }
        />

        <Route
          path="/api-docs"
          element={
            <ProtectedRoute>
              <ApiDocs />
            </ProtectedRoute>
          }
        />

      </Routes>
    </Router>
  );
}

export default App;
