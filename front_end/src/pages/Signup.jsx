import "../styles/Signup.css";
import { Link } from "react-router-dom";


export default function Signup() {
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
                    <button className="social-btn google">
                        <span>Sign Up With Google</span>
                    </button>
        
                </div>

                <div className="divider">
                    <span>or</span>
                </div>

                <div className="email-form">
                    <label className="input-label">Email</label>
                    <input 
                        type="email" 
                        placeholder="Enter Email" 
                        className="email-input"
                    />
                    <label className="password-input">Password</label>
                    <input
                        type="Password"
                        placeholder="Enter your password"
                        className="pass-in"
                    />
                    <Link to="/verification">
                    <button className="sign-button full">Sign Up</button>
                    </Link>
                </div>

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