import "../styles/Personal-info1.css";
import { Link } from "react-router-dom";

export default function PersonalInfo1() {
    return (
        <div className="personal-info-page">
            <div className="bg-overlay">
                <img 
                    src="/src/assets/runners.jpg" 
                    alt="Runners" 
                    className="bg-image"
                />
                <div className="dark-overlay"></div>
            </div>

            <div className="center-card dark">
                <h1 className="title">Personal Information</h1>
                
                <form className="personal-info-form">
                    <label className="input-label">Level</label>
                    <input
                    type = "text"
                    placeholder="Enter your level"
                    className="form-input"
                    />
                    <label className="input-label">Weight</label>
                    <input
                    type = "text"
                    placeholder="Enter your weight"
                    className="form-input"
                    />
                    <label className="input-label">Height</label>
                    <input
                    type = "text"
                    placeholder="Enter your height"
                    className="form-input"
                    />
                    <button type="submit" className="sign-button full">
                        Continue
                    </button>
                </form>
            </div>
        </div>
    );
}