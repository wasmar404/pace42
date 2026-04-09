import "../styles/Signup.css";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Signup() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(false);

    const onSignup = async (e) => {
        e.preventDefault();
        setError("");
        setNotice("");
        setLoading(true);
        try {
            if (String(password || '').length < 8) {
                throw new Error('Password must be at least 8 characters')
            }
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback?method=email&mode=signup&next=/personal-info`,
                },
            });
            if (signUpError) throw signUpError;

            if (data?.session) {
                navigate("/personal-info", { replace: true });
                return
            }
            setNotice('Account created. If Supabase requires email confirmation, check your inbox then log in.')
        } catch (err) {
            const msg = err?.message || "Signup failed"
            if (String(msg).toLowerCase().includes('email not confirmed')) {
                setError('Email not confirmed in Supabase. Delete/confirm the user in Supabase Auth users, then sign up again.')
            } else if (String(msg).toLowerCase().includes('user already registered') || String(msg).toLowerCase().includes('already registered')) {
                setError('Account already exists. Please log in instead.')
            } else {
                setError(msg)
            }
        } finally {
            setLoading(false);
        }
    };

    const onGoogle = async () => {
        setError("");
        const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback?method=google&mode=signup&next=/personal-info`,
            },
        });
        if (oauthError) {
            setError(oauthError.message);
            return;
        }
        if (data?.url) window.location.href = data.url;
    };

    return (
        <div className="Signup">
            <div className="bg-overlay">
                <img 
                    src="/assets/runners.jpg" 
                    alt="Runners" 
                    className="bg-image"
                />
                <div className="dark-overlay"></div>
            </div>

            <div className="center-card dark">
                <h1 className="title">Sign Up</h1>
                
                <p className="tagline">
                    Track your progress and reach goals.
                </p>
                <div className="social-buttons">
                    <button className="social-btn google" type="button" onClick={onGoogle}>
                        <img className="icon" src="/assets/google.png" alt="" aria-hidden="true" />
                        <span>Sign Up With Google</span>
                    </button>
                </div>

                <div className="divider">
                    <span>or</span>
                </div>

                <form className="email-form" onSubmit={onSignup}>
                    <label className="input-label" htmlFor="signup-email">Email</label>
                    <input 
                        id="signup-email"
                        name="email"
                        type="email" 
                        placeholder="Enter Email" 
                        className="email-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                    />
                    <label className="password-input" htmlFor="signup-password">Password</label>
                    <input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="Enter your password"
                        className="pass-in"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        autoComplete="new-password"
                    />
                    {error ? <p className="terms dark-text">{error}</p> : null}
                    {notice ? <p className="terms dark-text">{notice}</p> : null}
                    <button className="sign-button full" type="submit" disabled={loading}>
                        {loading ? "Signing up..." : "Sign Up"}
                    </button>
                </form>

                <p className="terms dark-text">
                    By continuing, you are agreeing to our <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
                </p>

                <p className="login-link">
                    Already a Member? <Link to="/login">Log in</Link>
                </p>
            </div>
        </div>
    );
}
