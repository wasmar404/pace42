import { Navigate, useLocation } from 'react-router-dom'

// Guard for flow pages that should not be directly opened.
// Currently used for /verification, which expects an email from the signup page.
export default function FlowRoute({ children, requireEmail = false }) {
  const location = useLocation()

  if (requireEmail) {
    const email = location.state?.email
    if (!email) return <Navigate to="/signup" replace />
  }

  return children
}
