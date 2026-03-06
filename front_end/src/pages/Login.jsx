import "../styles/Login.css";
import { Link } from "react-router-dom";

export default function Login() {
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

                <form className="login-form">
                    <label className="input-label">Email</label>
                    <input
                    type = "email"
                    placeholder="Enter your email"
                    className="form-input"
                    />
                    <label className="input-label">Password</label>
                    <input
                    type="password"
                    placeholder="Enter your password"
                    className="form-input"
                    />
                    <button type="submit" className="sign-button full">
                        Log In
                    </button>
                </form>
                <p className="signup-text">
                   Don't have an account? <Link to="/signup">Sign up</Link>
                </p>
            </div>
        </div>
    );
}