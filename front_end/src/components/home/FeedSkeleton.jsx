export default function FeedSkeleton() {
  return (
    <div className="feed-skel">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="feed-card sk" style={{ animationDelay: `${i * 40}ms` }} />
      ))}
    </div>
  )
}
