import { useNavigate } from "react-router-dom";
import "../styles/Legal.css";

export default function TermsOfService() {
    const navigate = useNavigate();

    return (
        <div className="legal-page">
            <div className="legal-container">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    ← Back
                </button>

                <h1>Terms of Service</h1>
                <p className="last-updated">Last Updated: March 29, 2026</p>

                <section>
                    <h2>1. Acceptance of Terms</h2>
                    <p>By creating an account and using Pace42, you agree to these Terms of Service. If you do not agree, please do not use the service.</p>
                </section>

                <section>
                    <h2>2. Description of Service</h2>
                    <p>Pace42 is a fitness and activity tracking social network that allows users to:</p>
                    <ul>
                        <li>Log and track fitness activities (running, cycling, walking, etc.)</li>
                        <li>Upload activity data including photos and GPX files</li>
                        <li>Connect with other users and view their activities</li>
                        <li>Give kudos and comment on activities</li>
                        <li>Access their fitness statistics and progress</li>
                    </ul>
                </section>

                <section>
                    <h2>3. User Accounts</h2>
                    <p>You are responsible for:</p>
                    <ul>
                        <li>Maintaining the security of your account credentials</li>
                        <li>All activities that occur under your account</li>
                        <li>Keeping your account information accurate and up to date</li>
                    </ul>
                    <p>You must be at least 13 years old to create an account.</p>
                </section>

                <section>
                    <h2>4. User Conduct</h2>
                    <p>You agree NOT to:</p>
                    <ul>
                        <li>Upload false, misleading, or inaccurate information</li>
                        <li>Harass, abuse, or harm other users</li>
                        <li>Upload inappropriate, offensive, or illegal content</li>
                        <li>Attempt to hack, disrupt, or abuse the service</li>
                        <li>Use the service for any commercial purposes without permission</li>
                        <li>Impersonate other users or create fake accounts</li>
                    </ul>
                </section>

                <section>
                    <h2>5. Content Ownership</h2>
                    <p><strong>Your Content:</strong> You retain ownership of the content you upload (activities, photos, comments). By uploading content, you grant Pace42 the right to display and store this content to provide the service.</p>
                    <p><strong>Our Content:</strong> The Pace42 platform, design, and features are owned by us and protected by copyright and other laws.</p>
                </section>

                <section>
                    <h2>6. Privacy</h2>
                    <p>Your use of Pace42 is also governed by our Privacy Policy. Please review it to understand how we collect and use your information.</p>
                </section>

                <section>
                    <h2>7. Service Availability</h2>
                    <p>Pace42 is provided "as is" without warranties. We do not guarantee:</p>
                    <ul>
                        <li>Uninterrupted or error-free service</li>
                        <li>That all features will work perfectly at all times</li>
                        <li>That your data will never be lost (please backup important data)</li>
                    </ul>
                    <p>This is an educational project created as part of the 42 curriculum.</p>
                </section>

                <section>
                    <h2>8. Account Termination</h2>
                    <p>We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time from the settings page.</p>
                </section>

                <section>
                    <h2>9. Limitation of Liability</h2>
                    <p>Pace42 and its creators are not liable for:</p>
                    <ul>
                        <li>Loss of data or content</li>
                        <li>Injuries or accidents related to fitness activities</li>
                        <li>Interactions between users</li>
                        <li>Any damages arising from use of the service</li>
                    </ul>
                    <p><strong>Fitness Disclaimer:</strong> Always consult a healthcare provider before starting any fitness program. Track your activities at your own risk.</p>
                </section>

                <section>
                    <h2>10. Changes to Terms</h2>
                    <p>We may update these Terms of Service. Continued use of Pace42 after changes constitutes acceptance of the new terms.</p>
                </section>

                <section>
                    <h2>11. Educational Project Notice</h2>
                    <p>Pace42 is an educational project created as part of the 42 School curriculum (ft_transcendence project). While we strive to provide a quality service, this is primarily a learning exercise.</p>
                </section>

                <section>
                    <h2>12. Contact</h2>
                    <p>For questions about these Terms of Service, please contact us through the application or use the contact information provided during registration.</p>
                </section>
            </div>
        </div>
    );
}
