import NavBar from '../components/NavBar'
import '../styles/ApiDocs.css'

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004'

export default function ApiDocs() {
  const authBlock = `x-api-key: <PUBLIC_API_KEY>\n# or\nauthorization: Bearer <PUBLIC_API_KEY>`
  const rateBlock = `X-RateLimit-Limit\nX-RateLimit-Remaining\nX-RateLimit-Reset`
  const createActivityBody = `{
  "sport": "run",
  "title": "Intervals",
  "description": "8x400m",
  "startedAt": "2026-03-26T10:00:00.000Z",
  "durationSeconds": 1800,
  "distanceMeters": 5000,
  "visibility": "public"
}`

  const updateActivityBody = `{
  "title": "Intervals (updated)",
  "visibility": "followers"
}`

  const deleteBody = `{
  "confirm": "DELETE"
}`

  const curlBlock = `export PACE42_API_KEY="..."

# Health
curl -H "x-api-key: $PACE42_API_KEY" "${BASE}/api/public/health"

# Search users
curl -H "x-api-key: $PACE42_API_KEY" "${BASE}/api/public/users?q=jo&take=20"

# List public activities
curl -H "x-api-key: $PACE42_API_KEY" "${BASE}/api/public/activities?take=20&since=2026-01-01T00:00:00Z"

# Create an activity (created under the API system user)
curl -H "x-api-key: $PACE42_API_KEY" -H "content-type: application/json" \
  -X POST "${BASE}/api/public/activities" \
  -d '${createActivityBody.replace(/\n/g, '')}'

# Update an activity
curl -H "x-api-key: $PACE42_API_KEY" -H "content-type: application/json" \
  -X PUT "${BASE}/api/public/activities/<activity_id>" \
  -d '${updateActivityBody.replace(/\n/g, '')}'

# Delete an activity
curl -H "x-api-key: $PACE42_API_KEY" -H "content-type: application/json" \
  -X DELETE "${BASE}/api/public/activities/<activity_id>" \
  -d '${deleteBody.replace(/\n/g, '')}'`

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
            <div className="m"><span className="verb post">POST</span> <code>/api/public/activities</code></div>
            <div className="d">Create an activity (stored under an internal “API system user”).</div>
            <pre><code>{createActivityBody}</code></pre>
          </div>

          <div className="api-docs-endpoint">
            <div className="m"><span className="verb put">PUT</span> <code>/api/public/activities/:id</code></div>
            <div className="d">Update an existing activity (only activities created by this API key are editable).</div>
            <pre><code>{updateActivityBody}</code></pre>
          </div>

          <div className="api-docs-endpoint">
            <div className="m"><span className="verb del">DELETE</span> <code>/api/public/activities/:id</code></div>
            <div className="d">Delete an activity (requires confirm body).</div>
            <pre><code>{deleteBody}</code></pre>
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
