import { Link } from 'react-router-dom'
import { Activity } from 'lucide-react'

export default function FeedEmpty() {
  return (
    <div className="feed-empty">
      <div className="icon"><Activity size={22} /></div>
      <div>
        <div className="t">No activities yet</div>
        <div className="s">Follow athletes or log your first workout to get started.</div>
      </div>
      <Link to="/activities/new" className="cta">Log activity</Link>
    </div>
  )
}
