import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { supabase } from '../supabaseClient'

export default function ResetPassword() {
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await supabase.auth.updateUser({ password })
      setMessage('Password updated')
      setTimeout(() => navigate('/login'), 800)
    } catch {
      setError('Failed to update password')
    }

    setLoading(false)
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Reset Password</h1>
      <form onSubmit={onSubmit}>
        <label>New password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        <button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
      {message ? <p>{message}</p> : null}
      {error ? <p>{error}</p> : null}
      <p>
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  )
}
