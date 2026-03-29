import "../styles/Landing.css";
import { Link } from "react-router-dom";
import cyclistsImg from "../assets/cyclists.jpg";
import runnersImg from "../assets/runners.jpg";
import logoImg from "../assets/logo.png";

export default function Landing() {
    return (
        <>
            <div className="Landing">
                {/* Left Background Image */}
                <div className="left-panel">
                    <img 
                        src="/src/assets/cyclists.jpg" 
                        alt="Cyclists" 
                        className="bg-image"
                    />
                </div>

                {/* Center Card */}
                <div className="center-card">
                    <img src={logoImg} alt="Pace42 Logo" className="logo" />
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
                        By continuing, you are agreeing to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
                    </p>
                </div>

                {/* Right Background Image */}
                <div className="right-panel">
                    <img 
                        src={runnersImg}
                        alt="Runners" 
                        className="bg-image"
                    />
                </div>
            </div>

        </>
    );
}