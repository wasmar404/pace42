import { Link } from 'react-router-dom'

import Avatar from '../Avatar'

export default function AthleteSummaryWidget({ me, avatarSeed }) {
  const followers = Number(me?.stats?.followersCount || 0)
  const following = Number(me?.stats?.followingCount || 0)
  const total = Number(me?.stats?.totalActivities || 0)
  const p = me?.profile
  const name = `${p?.firstName || ''} ${p?.lastName || ''}`.trim() || (p?.username ? `@${p.username}` : 'Athlete')
  const email = me?.user?.email || ''

  return (
    <section className="w w-ath">
      <div className="ath-top">
        <div className="ath-av">
          <Avatar avatarUrl={p?.avatarUrl} seed={avatarSeed} alt="" loading="eager" />
        </div>
        <div className="ath-name">{name}</div>
        {email ? <div className="ath-sub">{email}</div> : null}
      </div>

      <div className="ath-stats">
        <div className="s">
          <div className="k">Following</div>
          <div className="v">{following}</div>
        </div>
        <div className="s">
          <div className="k">Followers</div>
          <div className="v">{followers}</div>
        </div>
        <div className="s">
          <div className="k">Activities</div>
          <div className="v">{total}</div>
        </div>
      </div>

      <div className="ath-links">
        <Link to="/profile" className="ath-link">Your profile</Link>
        <Link to="/settings" className="ath-link">Settings</Link>
      </div>
    </section>
  )
}
