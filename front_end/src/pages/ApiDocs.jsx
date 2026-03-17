import NavBar from '../components/NavBar'
import '../styles/ApiDocs.css'

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004'

export default function ApiDocs() {
  const authBlock = `x-api-key: <PUBLIC_API_KEY>\n# or\nauthorization: Bearer <PUBLIC_API_KEY>`
  const rateBlock = `X-RateLimit-Limit\nX-RateLimit-Remaining\nX-RateLimit-Reset`
  const createClubBody = `{
  "name": "Downtown Run Club",
  "location": "Rabat, Morocco",
  "sport": "run",
  "description": "Weekly intervals + long run.",
  "isInviteOnly": false,
  "avatarUrl": null,
  "bannerUrl": null
}`
  const curlBlock = `export PACE42_API_KEY="..."

curl -H "x-api-key: $PACE42_API_KEY" "${BASE}/api/public/clubs?take=10&q=run"

curl -H "x-api-key: $PACE42_API_KEY" -H "content-type: application/json" \
  -X POST "${BASE}/api/public/clubs" \
  -d '{"name":"Test Club","location":"Rabat","sport":"run","description":"demo"}'`

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

          <div className="api-docs-endpoint">
            <div className="m"><span className="verb get">GET</span> <code>/api/public/clubs?q=run&amp;take=20</code></div>
            <div className="d">List clubs (search by name/location/description).</div>
          </div>

          <div className="api-docs-endpoint">
            <div className="m"><span className="verb post">POST</span> <code>/api/public/clubs</code></div>
            <div className="d">Create a club (owner is an internal system user derived from the API key).</div>
            <pre><code>{createClubBody}</code></pre>
          </div>

          <div className="api-docs-endpoint">
            <div className="m"><span className="verb put">PUT</span> <code>/api/public/clubs/:id</code></div>
            <div className="d">Update club fields (partial updates allowed).</div>
          </div>

          <div className="api-docs-endpoint">
            <div className="m"><span className="verb del">DELETE</span> <code>/api/public/clubs/:id</code></div>
            <div className="d">Delete a club.</div>
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
