import "../styles/Login.css";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004'

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
            if (!err) return

            const map = {
                intra_not_registered: 'No Intra account found. Use Intra signup first.',
                email_used_by_other_method: 'This email is already used by another sign-in method.',
                intra_token_exchange_failed: 'Intra sign-in failed (token exchange).',
                intra_profile_failed: 'Intra sign-in failed (profile).',
                intra_magiclink_failed: 'Intra sign-in failed (session).',
            }
            setError(map[err] || err)
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
            setError(error.message)
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

    const onIntra = () => {
        setError(null)
        window.location.href = `${BACKEND_URL}/api/auth/intra/start?mode=login&next=${encodeURIComponent('/home')}`
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
                        <img className="icon" src="/auth/google.png" alt="" aria-hidden="true" />
                        <span>Continue with Google</span>
                    </button>
                    <button className="social-btn google" type="button" onClick={onIntra}>
                        <img className="icon icon-42" src="/auth/42.svg" alt="" aria-hidden="true" />
                        <span>Continue with Intra</span>
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
                    <Link to="/forgot-password">Forgot password?</Link>
                </p>
                <p className="signup-text">
                   Don't have an account? <Link to="/signup">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
