import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Verification.css";
import { supabase } from "../supabaseClient";

export default function Verification() {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [navigate, nextPath]);

  const onResend = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Enter your email to resend the verification email.");
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
      setMessage("Verification email re-sent. Check your inbox.");
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

        <h1 className="title">Verification Code</h1>

        <p className="subtitle">
          Check your email and click the verification link to confirm your account.
          After you confirm, you'll be redirected back into the app automatically.
        </p>

        <label className="input-label">Email</label>
        <input
          type="email"
          placeholder="Enter your email"
          className="form-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

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
