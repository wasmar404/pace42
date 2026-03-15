export default function AnnouncementCard({ item }) {
  return (
    <article className="feed-card ann">
      <div className="ann-top">
        <div className="ann-badge">
          <span className="dot" />
          Club
        </div>
        <div className="ann-club">
          <span className="icon" aria-hidden="true">{item?.club?.icon || '🏁'}</span>
          <span>{item?.club?.name || 'Club'}</span>
        </div>
      </div>
      <h3 className="ann-title">{item?.title || 'Announcement'}</h3>
      <p className="ann-body">{item?.body || ''}</p>
    </article>
  )
}
