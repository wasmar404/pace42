import "../styles/Personal-info.css";
import { useNavigate } from "react-router-dom";

export default function PersonalInfo() {
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        navigate("/personal-info1");
    };
    return (
        <div className="personal-info-page">
            <div className="personal-info-card">
                <h2>Personal Information</h2>
                <form className="personal-info-form" onSubmit={handleSubmit}>
                    <label>First Name</label>
                    <input
                    type = "text"
                    placeholder="Enter your first name"
                    />
                    <label>Last Name</label>
                    <input
                    type = "text"
                    placeholder="Enter your last name"
                    />
                    <label>Date of Birth</label>
                    <input
                    type = "date"
                    />
                    <label>Gender</label>
                    <select defaultValue="">
                        <option value="" disabled>Select your gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                    </select>
                    <button type="submit" className="pi-btn">
                        Continue
                    </button>
                </form>
            </div>
        </div>
    );
}   