import "../styles/Personal-info1.css";
import { Link } from "react-router-dom";

export default function PersonalInfo1() {
    return (
        <div className="personal-info-page">
            <div className="personal-info-card">
                <h2>Personal Information</h2>
                <form className="personal-info-form">
                    <label>Level</label>
                    <input
                    type = "text"
                    placeholder="Enter your level"
                    />
                    <label>Weight</label>
                    <input
                    type = "text"
                    placeholder="Enter your weight"
                    />
                    <label>Height</label>
                    <input
                    type = "text"
                    placeholder="Enter your height"
                    />
                    <button type="submit" className="pi-btn">
                        Continue
                    </button>
                </form>
            </div>
        </div>
    );
}