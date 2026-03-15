export default function Widget({ icon, title, children }) {
  return (
    <section className="w">
      <header className="w-h">
        <span className="w-i">{icon}</span>
        <h3>{title}</h3>
      </header>
      <div className="w-b">{children}</div>
    </section>
  )
}
