import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { backendJson, backendUpload } from "../backendApi";

export default function PersonalInfo() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [profileImage, setProfileImage] = useState(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [gender, setGender] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);


    const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
        await backendJson("PUT", "/api/me/personal", {
        firstName,
        lastName,
        dateOfBirth,
        gender,
        });

        navigate("/personal-info1");
    } catch (err) {
        setError("Failed to save info");
    }

    setLoading(false);
    };


    const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setProfileImage(URL.createObjectURL(file));
    setAvatarUploading(true);

    try {
        await backendUpload("/api/me/avatar", file);
    } catch {
        setError("Upload failed");
    }

    setAvatarUploading(false);
    };


    const handleAvatarClick = () => {
    fileInputRef.current.click();
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
               

                {/* Profile Picture Upload */}
                <div className="avatar-wrapper">
                    <div className="avatar-circle" onClick={handleAvatarClick}>
                        {profileImage ? (
                            <img
                                src={profileImage}
                                alt="Profile"
                                className="avatar-preview"
                            />
                        ) : (
                            <svg
                                className="avatar-placeholder-icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <circle cx="12" cy="8" r="4" fill="#9ca3af" />
                                <path
                                    d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
                                    stroke="#9ca3af"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                        )}
                        <div className="camera-badge" onClick={handleAvatarClick}>
                            <svg
                                viewBox="0 0 24 24"
                                fill="white"
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                            >
                                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                                <path d="M20 4h-3.17l-1.24-1.35A2 2 0 0 0 14.12 2H9.88a2 2 0 0 0-1.47.65L7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
                            </svg>
                        </div>
                    </div>
                    <p className="avatar-label">
                        <strong>Upload Photo</strong>{" "}

                    </p>
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        style={{ display: "none" }}
                    />
                </div>

                <form className="personal-info-form" onSubmit={handleSubmit}>
                    <label className="input-label">First Name</label>
                    <input
                        type="text"
                        placeholder="Enter your first name"
                        className="form-input"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                    />
                    <label className="input-label">Last Name</label>
                    <input
                        type="text"
                        placeholder="Enter your last name"
                        className="form-input"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                    />
                    <label className="input-label">Date of Birth</label>
                    <input
                        type="date"
                        className="form-input"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                    <label className="input-label">Gender</label>
                    <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="form-input"
                    >
                        <option value="" disabled>
                            Select your gender
                        </option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                    </select>
                    <button type="submit" className="sign-button full">
                    </button>
                </form>
            </div>
        </div>
    );
}
