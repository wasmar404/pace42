import { useState } from "react";
import { useNavigate } from "react-router-dom";
import OTPInput from "react-otp-input";
import "../styles/Verification.css";

export default function Verification() {
  const [otp, setOtp] = useState("");
  const navigate = useNavigate();

  return (
    <div className="verification">

      {/* Background Section */}
      <div className="bg-overlay">
        <img
          src="/src/assets/runners.jpg"
          alt="Runners"
          className="bg-image"
        />
        <div className="dark-overlay"></div>
      </div>

      {/* Center Card */}
      <div className="center-card dark">

        <h1 className="title">Verification Code</h1>

        <p className="subtitle">
          Enter the 6-digit code sent to your email.
        </p>

        {/* OTP BOXES */}
        <OTPInput
          value={otp}
          onChange={setOtp}
          numInputs={6}
          renderSeparator={<span> </span>}
          renderInput={(props) => (
            <input {...props} className="otp-input" />
          )}
        />

        <a href="#" className="resend-link">Resend Code</a>
        {/* Button */}
        <button className="verify-btn" onClick={() => navigate("/personal-info")}>
          Verify
        </button>

      </div>
    </div>
  );
}
