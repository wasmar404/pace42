import { Link, useNavigate } from "react-router-dom";
import "../styles/Legal.css";

export default function TermsOfService() {
    const navigate = useNavigate();

    const toc = [
        { id: "acceptance", label: "Acceptance of Terms" },
        { id: "service", label: "Service Description" },
        { id: "accounts", label: "User Accounts" },
        { id: "conduct", label: "User Conduct" },
        { id: "ownership", label: "Content Ownership" },
        { id: "privacy", label: "Privacy" },
        { id: "availability", label: "Service Availability" },
        { id: "termination", label: "Account Termination" },
        { id: "liability", label: "Limitation of Liability" },
        { id: "changes", label: "Changes to Terms" },
        { id: "education", label: "Educational Notice" },
        { id: "contact", label: "Contact" },
    ]

    return (
        <div className="legal-page">
            <div className="legal-shell">
                <header className="legal-top">
                    <button className="legal-back" type="button" onClick={() => navigate(-1)}>
                        ← Back
                    </button>
                    <nav className="legal-toplinks" aria-label="Legal links">
                        <Link to="/terms" aria-current="page">Terms</Link>
                        <span className="sep" aria-hidden="true">•</span>
                        <Link to="/privacy">Privacy</Link>
                    </nav>
                </header>

                <section className="legal-hero" aria-label="Terms of Service header">
                    <div className="legal-k">Pace42 Legal</div>
                    <h1>Terms of Service</h1>
                    <p className="legal-lede">
                        These terms cover account rules, acceptable use, and how the service is provided.
                    </p>
                    <div className="legal-meta">
                        <span className="pill">Last updated: March 29, 2026</span>
                        <span className="pill">Applies to: Pace42 app</span>
                    </div>
                </section>

                <div className="legal-grid">
                    <aside className="legal-toc" aria-label="On this page">
                        <div className="toc-head">On this page</div>
                        <div className="toc-list">
                            {toc.map((t) => (
                                <a key={t.id} href={`#${t.id}`} className="toc-link">
                                    {t.label}
                                </a>
                            ))}
                        </div>
                        <div className="toc-foot">
                            <Link to="/signup" className="toc-cta">Create account</Link>
                            <Link to="/" className="toc-alt">Back to landing</Link>
                        </div>
                    </aside>

                    <article className="legal-doc">
                        <section id="acceptance">
                            <h2>1. Acceptance of Terms</h2>
                    <p>By creating an account and using Pace42, you agree to these Terms of Service. If you do not agree, please do not use the service.</p>
                        </section>

                        <section id="service">
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

                        <section id="accounts">
                            <h2>3. User Accounts</h2>
                    <p>You are responsible for:</p>
                    <ul>
                        <li>Maintaining the security of your account credentials</li>
                        <li>All activities that occur under your account</li>
                        <li>Keeping your account information accurate and up to date</li>
                    </ul>
                    <p>You must be at least 13 years old to create an account.</p>
                        </section>

                        <section id="conduct">
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

                        <section id="ownership">
                            <h2>5. Content Ownership</h2>
                    <p><strong>Your Content:</strong> You retain ownership of the content you upload (activities, photos, comments). By uploading content, you grant Pace42 the right to display and store this content to provide the service.</p>
                    <p><strong>Our Content:</strong> The Pace42 platform, design, and features are owned by us and protected by copyright and other laws.</p>
                        </section>

                        <section id="privacy">
                            <h2>6. Privacy</h2>
                    <p>Your use of Pace42 is also governed by our Privacy Policy. Please review it to understand how we collect and use your information.</p>
                        </section>

                        <section id="availability">
                            <h2>7. Service Availability</h2>
                    <p>Pace42 is provided "as is" without warranties. We do not guarantee:</p>
                    <ul>
                        <li>Uninterrupted or error-free service</li>
                        <li>That all features will work perfectly at all times</li>
                        <li>That your data will never be lost (please backup important data)</li>
                    </ul>
                    <p>This is an educational project created as part of the 42 curriculum.</p>
                        </section>

                        <section id="termination">
                            <h2>8. Account Termination</h2>
                    <p>We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time from the settings page.</p>
                        </section>

                        <section id="liability">
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

                        <section id="changes">
                            <h2>10. Changes to Terms</h2>
                    <p>We may update these Terms of Service. Continued use of Pace42 after changes constitutes acceptance of the new terms.</p>
                        </section>

                        <section id="education">
                            <h2>11. Educational Project Notice</h2>
                    <p>Pace42 is an educational project created as part of the 42 School curriculum (ft_transcendence project). While we strive to provide a quality service, this is primarily a learning exercise.</p>
                        </section>

                        <section id="contact">
                            <h2>12. Contact</h2>
                    <p>For questions about these Terms of Service, please contact us through the application or use the contact information provided during registration.</p>
                        </section>
                    </article>
                </div>
            </div>
        </div>
    );
}
