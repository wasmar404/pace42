import "../styles/Landing.css";
import { Link } from "react-router-dom";

export default function Landing() {
    return (
        <>
            <div className="Landing">
                <div className="left-panel">
                    <img 
                        src="/assets/cyclists.jpg" 
                        alt="Cyclists" 
                        className="bg-image"
                    />
                </div>

                <div className="center-card">
                    <img src="/assets/logo.png" alt="Pace42 Logo" className="logo" />
                    <p className="tagline">
                        Track your progress and cheer each other on. Join Pace42 for free.
                    </p>
                    <div className="Buttons">
                        <Link to="/login">
                            <button className="log-button">Log In</button>
                        </Link>
                        <Link to="/signup">
                            <button className="sign-button">Sign Up</button>
                        </Link>
                    </div>
                    <p className="terms">
                        By continuing, you are agreeing to our <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
                    </p>
                </div>

                <div className="right-panel">
                    <img 
                        src="/assets/runners.jpg" 
                        alt="Runners" 
                        className="bg-image"
                    />
                </div>
            </div>

        </>
    );
}
