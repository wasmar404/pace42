import { Link } from "react-router-dom";
import "../styles/Footer.css";

export default function Footer() {
    return (
        <footer className="app-footer">
            <div className="footer-content">
                <p>&copy; 2026 Pace42. Educational project for 42 School.</p>
                <div className="footer-links">
                    <Link to="/privacy">Privacy Policy</Link>
                    <span className="separator">•</span>
                    <Link to="/terms">Terms of Service</Link>
                </div>
            </div>
        </footer>
    );
}
