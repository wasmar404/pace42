import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Verification from "./pages/Verification";
import PersonalInfo from "./pages/Personal-info";
import PersonalInfo1 from "./pages/Personal-info1";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
       <Route path="/verification" element={<Verification />} />
       <Route path="/personal-info" element={<PersonalInfo />} />
       <Route path="/personal-info1" element={<PersonalInfo1 />} />

      </Routes>
    </Router>
  );
}

export default App;