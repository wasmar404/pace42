import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Verification from "./pages/Verification";
import PersonalInfo from "./pages/Personal-info";
import PersonalInfo1 from "./pages/Personal-info1";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./routes/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
       <Route path="/verification" element={<Verification />} />
       <Route path="/auth/callback" element={<AuthCallback />} />
       <Route path="/forgot-password" element={<ForgotPassword />} />
       <Route path="/reset-password" element={<ResetPassword />} />
       <Route
         path="/personal-info"
         element={
           <ProtectedRoute>
             <PersonalInfo />
           </ProtectedRoute>
         }
       />
       <Route
         path="/personal-info1"
         element={
           <ProtectedRoute>
             <PersonalInfo1 />
           </ProtectedRoute>
         }
       />

      </Routes>
    </Router>
  );
}

export default App;
