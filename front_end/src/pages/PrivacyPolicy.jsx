import { Link, useNavigate } from "react-router-dom";
import "../styles/Legal.css";

export default function PrivacyPolicy() {
    const navigate = useNavigate();

    const toc = [
        { id: "collect", label: "Information We Collect" },
        { id: "use", label: "How We Use Data" },
        { id: "sharing", label: "Information Sharing" },
        { id: "security", label: "Storage & Security" },
        { id: "third-parties", label: "Third-Party Services" },
        { id: "rights", label: "Your Rights" },
        { id: "cookies", label: "Cookies" },
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
                        <Link to="/terms">Terms</Link>
                        <span className="sep" aria-hidden="true">•</span>
                        <Link to="/privacy" aria-current="page">Privacy</Link>
                    </nav>
                </header>

                <section className="legal-hero" aria-label="Privacy Policy header">
                    <div className="legal-k">Pace42 Legal</div>
                    <h1>Privacy Policy</h1>
                    <p className="legal-lede">
                        This explains what we collect, why we collect it, and the controls you have.
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
                        <section id="collect">
                            <h2>1. Information We Collect</h2>
                    <p>We collect information you provide when you:</p>
                    <ul>
                        <li>Create an account (email, password, name)</li>
                        <li>Upload a profile picture or avatar</li>
                        <li>Log fitness activities (distance, duration, type, GPX files)</li>
                        <li>Upload activity photos and media</li>
                        <li>Send messages to other users</li>
                        <li>Add friends and interact with other users</li>
                    </ul>
                        </section>

                        <section id="use">
                            <h2>2. How We Use Your Information</h2>
                    <p>Your information is used to:</p>
                    <ul>
                        <li>Provide and maintain the Pace42 service</li>
                        <li>Display your activities and profile to other users</li>
                        <li>Enable social features (friends, comments, kudos)</li>
                        <li>Store and display your fitness statistics</li>
                        <li>Send notifications about your account activity</li>
                    </ul>
                        </section>

                        <section id="sharing">
                            <h2>3. Information Sharing</h2>
                    <p>Your profile information and activities are visible to other Pace42 users. We do not sell your personal information to third parties.</p>
                    <p>You can control your privacy by adjusting your account settings.</p>
                        </section>

                        <section id="security">
                            <h2>4. Data Storage and Security</h2>
                    <p>Your data is stored securely using:</p>
                    <ul>
                        <li>Encrypted passwords (hashed and salted)</li>
                        <li>Secure HTTPS connections</li>
                        <li>Database access controls</li>
                        <li>Regular security updates</li>
                    </ul>
                        </section>

                        <section id="third-parties">
                            <h2>5. Third-Party Services</h2>
                    <p>We use the following third-party services:</p>
                    <ul>
                        <li><strong>Google OAuth:</strong> For optional Google login</li>
                        <li><strong>Supabase:</strong> For authentication and file storage</li>
                    </ul>
                    <p>These services have their own privacy policies.</p>
                        </section>

                        <section id="rights">
                            <h2>6. Your Rights</h2>
                    <p>You have the right to:</p>
                    <ul>
                        <li>Access your personal data</li>
                        <li>Update or correct your information</li>
                        <li>Delete your account and data</li>
                        <li>Export your activity data</li>
                    </ul>
                    <p>To exercise these rights, contact us or use the settings page.</p>
                        </section>

                        <section id="cookies">
                            <h2>7. Cookies</h2>
                    <p>We use cookies and local storage to:</p>
                    <ul>
                        <li>Keep you logged in</li>
                        <li>Remember your preferences</li>
                        <li>Improve your experience</li>
                    </ul>
                        </section>

                        <section id="contact">
                            <h2>8. Contact Us</h2>
                    <p>If you have questions about this Privacy Policy, please contact us through the app or at the email provided during registration.</p>
                        </section>
                    </article>
                </div>
            </div>
        </div>
    );
}
