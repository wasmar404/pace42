import "../styles/ForgotPassword.css";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMsg('Reset link sent to your email');
    } catch (err) {
      setMsg(err?.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ForgotPassword">
      <div className="bg-overlay">
        <img 
          src="/src/assets/runners.jpg" 
          alt="Runners" 
          className="bg-image"
        />
        <div className="dark-overlay"></div>
      </div>

      <div className="center-card dark">
        <h1 className="title">Forgot Password</h1>
        
        <p className="tagline">
          Enter your email to receive a password reset link.
        </p>

        <form className="email-form" onSubmit={onSubmit}>
          <label className="input-label">Email</label>
          <input 
            type="email" 
            placeholder="Enter your email" 
            className="email-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {msg && <p className="terms dark-text">{msg}</p>}

          <button className="sign-button full" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p className="login-link">
          Remember your password? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}