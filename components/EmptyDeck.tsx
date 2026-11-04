/** Placeholder before the first deal: a face-down deck on the table. */
export default function EmptyDeck({ text }: { text: string }) {
  return (
    <div className="empty-deck">
      <div className="deck" aria-hidden="true">
        <span className="deck-card" />
        <span className="deck-card" />
        <span className="deck-card" />
      </div>
      <p className="empty-deck-text">{text}</p>
    </div>
  );
}
