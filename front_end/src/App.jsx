import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Verification from "./pages/Verification";
import PersonalInfo from "./pages/Personal-info";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
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
import Clubs from "./pages/Clubs";
import ClubDetails from "./pages/ClubDetails";
import ApiDocs from "./pages/ApiDocs";
import Training from "./pages/Training";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
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
        <Route path="/verification" element={<Verification />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/mfa" element={<Mfa />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
          path="/clubs"
          element={
            <ProtectedRoute>
              <Clubs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clubs/:id"
          element={
            <ProtectedRoute>
              <ClubDetails />
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
