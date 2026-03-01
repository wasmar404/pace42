import "../styles/Login.css";
import { Link } from "react-router-dom";

export default function Login() {
    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <h2>Log In</h2>
                </div>

                <form className="login-form">
                    <label>Email</label>
                    <input
                    type = "email"
                    placeholder="Enter your email"
                    />
                    <label>Password</label>
                    <input
                    type="Password"
                    placeholder="Enter your password"
                    />
                    <button type="submit" className="lg-btn">
                        Log In
                    </button>
                </form>
                <p className="signup-text">
                   Don't have an account? <Link to="/signup">Sign up</Link>  </p>
            </div>
        </div>
    );
}