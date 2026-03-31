import "../styles/Login.css";
import googleIcon from "../assets/google.png";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search)
            const err = params.get('error')
            const message = params.get('message')
            if (!err) return

            const map = {
                email_used_by_other_method: 'This email is already used by another sign-in method.',
                already_registered: 'Account already exists. Please log in instead of signing up again.',
            }
            setError(message || map[err] || err)
        } catch {
            // ignore
        }
    }, [])

    const onLogin = async (e) => {
        e.preventDefault()
        setLoading(true)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            const msg = error.message || 'Login failed'
            if (String(msg).toLowerCase().includes('email not confirmed')) {
                setError('Email not confirmed in Supabase. Delete/confirm the user in Supabase Auth users, then sign up again (or disable confirmations and create a new user).')
            } else {
                setError(msg)
            }
        } else {
            // Enforce: email/password accounts cannot be linked to OAuth.
            const { data } = await supabase.auth.getUser().catch(() => ({ data: null }))
            const providers = Array.isArray(data?.user?.app_metadata?.providers)
                ? data.user.app_metadata.providers
                : (data?.user?.app_metadata?.provider ? [data.user.app_metadata.provider] : [])

            if (providers.includes('google')) {
                await supabase.auth.signOut().catch(() => {})
                setError('This account uses Google sign-in. Use "Continue with Google" instead.')
            } else {
                navigate("/home")
            }
        }

        setLoading(false)
        }

    const onGoogle = async () => {
        setError(null)
        const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback?method=google&mode=login&next=/home`,
            },
        })
        if (oauthError) {
            setError(oauthError.message)
            return
        }
        if (data?.url) window.location.href = data.url
    }

    return (
        <div className="login-page">
            <div className="bg-overlay">
                <img 
                    src="/src/assets/runners.jpg" 
                    alt="Runners" 
                    className="bg-image"
                />
                <div className="dark-overlay"></div>
            </div>

            <div className="center-card dark">
                <h1 className="title">Log In</h1>

                <div className="social-buttons">
                    <button className="social-btn google" type="button" onClick={onGoogle}>
                        <img className="icon" src={googleIcon} alt="" aria-hidden="true" />
                        <span>Continue with Google</span>
                    </button>
                </div>

                <div className="divider">
                    <span>or</span>
                </div>

                <form className="login-form" onSubmit={onLogin}>
                    <label className="input-label">Email</label>
                    <input
                    type = "email"
                    placeholder="Enter your email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    />
                    <label className="input-label">Password</label>
                    <input
                    type="password"
                    placeholder="Enter your password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    />
                    {error ? <p className="signup-text">{error}</p> : null}
                    <button type="submit" className="sign-button full" disabled={loading}>
                        {loading ? "Logging in..." : "Log In"}
                    </button>
                </form>
                
                <p className="signup-text">
                   Don't have an account? <Link to="/signup">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
