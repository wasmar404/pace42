import NavBar from '../components/NavBar'
import '../styles/ApiDocs.css'

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004'

export default function ApiDocs() {
  const authBlock = `x-api-key: <PUBLIC_API_KEY>\n# or\nauthorization: Bearer <PUBLIC_API_KEY>`
  const rateBlock = `X-RateLimit-Limit\nX-RateLimit-Remaining\nX-RateLimit-Reset`
  const curlBlock = `export PACE42_API_KEY="..."

curl -H "x-api-key: $PACE42_API_KEY" "${BASE}/api/public/health"`

  return (
    <div className="api-docs-page">
      <NavBar />

      <main className="api-docs-wrap">
        <header className="api-docs-hero">
          <div className="k">Public API</div>
          <h1>Pace42 Integration API</h1>
          <p>Shared-key API for automated tools. All requests require an API key and are rate-limited.</p>
          <div className="api-docs-pill">
            <span className="t">Base URL</span>
            <code>{BASE}</code>
          </div>
        </header>

        <section className="api-docs-card">
          <h2>Authentication</h2>
          <p>Send the shared API key in one of these headers:</p>
          <pre><code>{authBlock}</code></pre>
          <p>
            Configure the key server-side with <code>PUBLIC_API_KEY</code>. This API key is the same for everyone.
          </p>
        </section>

        <section className="api-docs-card">
          <h2>Rate limiting</h2>
          <p>Rate limit is enforced per API key + IP. Responses include:</p>
          <pre><code>{rateBlock}</code></pre>
        </section>

        <section className="api-docs-card">
          <h2>Endpoints</h2>

          <div className="api-docs-endpoint">
            <div className="m"><span className="verb get">GET</span> <code>/api/public/health</code></div>
            <div className="d">Health check for the Public API.</div>
          </div>

          <div className="api-docs-endpoint">
            <div className="m"><span className="verb get">GET</span> <code>/api/public/users?q=jo&amp;take=20</code></div>
            <div className="d">Search users by username/first/last (requires 2+ characters).</div>
          </div>

          <div className="api-docs-endpoint">
            <div className="m"><span className="verb get">GET</span> <code>/api/public/activities?take=20&amp;since=2026-01-01T00:00:00Z</code></div>
            <div className="d">List public activities, newest first.</div>
          </div>
        </section>

        <section className="api-docs-card">
          <h2>cURL examples</h2>
          <pre><code>{curlBlock}</code></pre>
        </section>
      </main>
    </div>
  )
}
