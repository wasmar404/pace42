import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Verification.css";
import { supabase } from "../supabaseClient";

export default function Verification() {
  const navigate = useNavigate();
  const location = useLocation();
  const codeRef = useRef(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const next = params.get("next");
    if (!next) return "/personal-info";
    if (!next.startsWith("/")) return "/personal-info";
    if (next.startsWith("//")) return "/personal-info";
    return next;
  }, [location.search]);

  const [email, setEmail] = useState(location.state?.email ?? "");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // If the user arrived here from an email confirmation link,
      // Supabase will have established a session.
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      if (data.session) {
        navigate(nextPath, { replace: true });
      }

      setTimeout(() => codeRef.current?.focus(), 0);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [navigate, nextPath]);

  const onVerifyCode = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    const token = String(code || "").replace(/\s+/g, "").trim();
    if (token.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    setError("");
    setMessage("");
    setVerifying(true);
    try {
      const { data, error: vErr } = await supabase.auth.verifyOtp({
        type: "signup",
        email,
        token,
      });
      if (vErr) throw vErr;

      // verifyOtp should create a session; still, be defensive.
      if (data?.session) {
        navigate(nextPath, { replace: true });
      } else {
        navigate(nextPath, { replace: true });
      }
    } catch (err) {
      setError(err?.message || "Invalid code");
      setCode("");
      setTimeout(() => codeRef.current?.focus(), 0);
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Enter your email to resend the code.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/verification?next=/personal-info`,
        },
      });
      if (resendError) throw resendError;
      setMessage("Code re-sent. Check your inbox.");
    } catch (err) {
      setError(err?.message || "Failed to resend email");
    } finally {
      setLoading(false);
    }
  };

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

        <h1 className="title">Verify Your Email</h1>

        <p className="subtitle">Check your email for a 6-digit code and enter it here.</p>

        <label className="input-label">Email</label>
        <input
          type="email"
          placeholder="Enter your email"
          className="form-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <form onSubmit={onVerifyCode}>
          <label className="input-label">6-digit code</label>
          <input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123 456"
            className="form-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={verifying}
          />

          <button className="verify-btn" type="submit" disabled={verifying || !email || code.replace(/\s+/g, "").length < 6}>
            {verifying ? "Verifying..." : "Verify"}
          </button>
        </form>

        {message ? <p className="subtitle">{message}</p> : null}
        {error ? <p className="subtitle">{error}</p> : null}

        <a href="#" className="resend-link" onClick={onResend}>
          {loading ? "Sending..." : "Resend email"}
        </a>

        <button className="verify-btn" onClick={() => navigate("/login")}>
          Back to Login
        </button>

      </div>
    </div>
  );
}
