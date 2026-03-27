import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { backendJson, backendUploadWithProgress } from "../backendApi";
import "../styles/Personal-info.css";

export default function PersonalInfo() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [profileImage, setProfileImage] = useState(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [gender, setGender] = useState("");
    const [bio, setBio] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [uploadPct, setUploadPct] = useState(0);


    const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate all fields are filled
    if (!firstName.trim()) {
        setError("Please enter your first name");
        return;
    }
    if (!lastName.trim()) {
        setError("Please enter your last name");
        return;
    }
    if (!dateOfBirth) {
        setError("Please select your date of birth");
        return;
    }
    if (!gender) {
        setError("Please select your gender");
        return;
    }

    setLoading(true);

    try {
        await backendJson("PUT", "/api/me", {
        firstName,
        lastName,
        dateOfBirth,
        gender,
        bio,
        });

        navigate("/home");
    } catch (err) {
        setError("Failed to save info");
    }

    setLoading(false);
    };


    const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Avatar must be JPG, PNG, or WEBP');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        setError('Avatar must be <= 5MB');
        return;
    }

    setProfileImage(URL.createObjectURL(file));
    setAvatarUploading(true);
    setUploadPct(0);

    try {
        await backendUploadWithProgress("/api/me/avatar", file, {
            onProgress: (p) => setUploadPct(Math.round(p * 100)),
        });
    } catch {
        setError("Upload failed");
    }

    setAvatarUploading(false);
    setUploadPct(0);
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
                    {avatarUploading && uploadPct > 0 ? (
                        <p className="avatar-label">Uploading: {uploadPct}%</p>
                    ) : null}
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
                        onChange={(e) => {
                            setFirstName(e.target.value);
                            if (error) setError("");
                        }}
                    />
                    <label className="input-label">Last Name</label>
                    <input
                        type="text"
                        placeholder="Enter your last name"
                        className="form-input"
                        value={lastName}
                        onChange={(e) => {
                            setLastName(e.target.value);
                            if (error) setError("");
                        }}
                    />
                    <label className="input-label">Date of Birth</label>
                    <input
                        type="date"
                        className="form-input"
                        value={dateOfBirth}
                        onChange={(e) => {
                            setDateOfBirth(e.target.value);
                            if (error) setError("");
                        }}
                    />
                    <label className="input-label">Gender</label>
                    <select
                        value={gender}
                        onChange={(e) => {
                            setGender(e.target.value);
                            if (error) setError("");
                        }}
                        className="form-input"
                    >
                        <option value="" disabled>
                            Select your gender
                        </option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                    </select>
                    <label className="input-label">Bio</label>
                    <textarea
                        placeholder="Tell us about yourself"
                        className="form-input"
                        value={bio}
                        onChange={(e) => {
                            setBio(e.target.value);
                            if (error) setError("");
                        }}
                        rows={3}
                        style={{ resize: "vertical" }}
                    />

                    {error && <p className="error-message">{error}</p>}

                    <button type="submit" className="sign-button full" disabled={loading}>
                        {loading ? "Saving..." : "Continue"}
                    </button>
                </form>
            </div>
        </div>
    );
}
