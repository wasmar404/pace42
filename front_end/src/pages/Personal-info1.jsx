import "../styles/Personal-info1.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

import { backendJson } from "../backendApi";

export default function PersonalInfo1() {
    const navigate = useNavigate();
    const [level, setLevel] = useState("");
    const [weightKg, setWeightKg] = useState("");
    const [heightCm, setHeightCm] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await backendJson("PUT", "/api/me/physical", {
                level,
                weightKg: weightKg ? Number(weightKg) : undefined,
                heightCm: heightCm ? Number(heightCm) : undefined,
            });
            navigate("/");
        } catch (err) {
            setError(err?.message || "Failed to save physical info");
        } finally {
            setLoading(false);
        }
    };

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
                
                <form className="personal-info-form" onSubmit={onSubmit}>
                    <label className="input-label">Level</label>
                    <input
                    type = "text"
                    placeholder="Enter your level"
                    className="form-input"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    />
                    <label className="input-label">Weight</label>
                    <input
                    type = "number"
                    placeholder="Enter your weight"
                    className="form-input"
                    min={1}
                    max={500}
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    />
                    <label className="input-label">Height</label>
                    <input
                    type = "number"
                    placeholder="Enter your height"
                    className="form-input"
                    min={1}
                    max={300}
                    step="0.1"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    />
                    {error ? <p className="input-label">{error}</p> : null}
                    <button type="submit" className="sign-button full">
                        {loading ? "Saving..." : "Continue"}
                    </button>
                </form>
            </div>
        </div>
    );
}
