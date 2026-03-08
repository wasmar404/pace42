import "../styles/Login.css";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

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
            navigate("/personal-info")
        }

        setLoading(false)
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