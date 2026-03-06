import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setMsg(error ? error.message : 'Reset link sent')
  }

  return (
    <div>
      <h1>Forgot Password</h1>

      <form onSubmit={onSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button type="submit">Send reset link</button>
      </form>

      {msg && <p>{msg}</p>}

      <Link to="/login">Back to login</Link>
    </div>
  )
}