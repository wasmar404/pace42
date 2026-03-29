import "../styles/Signup.css";
import googleIcon from "../assets/google.png";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Signup() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const onSignup = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            if (String(password || '').length < 8) {
                throw new Error('Password must be at least 8 characters')
            }
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    // After the user clicks the email confirmation link,
                    // Supabase will redirect them back to this URL.
                    emailRedirectTo: `${window.location.origin}/verification?next=/personal-info`,
                },
            });
            if (signUpError) throw signUpError;

            // If email confirmations are disabled (common in local dev), Supabase returns a session.
            if (data?.session) {
                navigate("/personal-info", { replace: true });
            } else {
                navigate("/verification", { state: { email } });
            }
        } catch (err) {
            setError(err?.message || "Signup failed");
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
                    src="/src/assets/runners.jpg" 
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
                        <img className="icon" src={googleIcon} alt="" aria-hidden="true" />
                        <span>Sign Up With Google</span>
                    </button>
                </div>

                <div className="divider">
                    <span>or</span>
                </div>

                <form className="email-form" onSubmit={onSignup}>
                    <label className="input-label">Email</label>
                    <input 
                        type="email" 
                        placeholder="Enter Email" 
                        className="email-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <label className="password-input">Password</label>
                    <input
                        type="Password"
                        placeholder="Enter your password"
                        className="pass-in"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                    />
                    {error ? <p className="terms dark-text">{error}</p> : null}
                    <button className="sign-button full" type="submit" disabled={loading}>
                        {loading ? "Signing up..." : "Sign Up"}
                    </button>
                </form>

                <p className="terms dark-text">
                    By continuing, you are agreeing to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
                </p>

                <p className="login-link">
                    Already a Member? <Link to="/login">Log in</Link>
                </p>
            </div>
        </div>
    );
}
