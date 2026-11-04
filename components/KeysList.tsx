type Tab = 'story' | 'character';

const KEYS: { keys: string[]; label: string; tabs?: Tab[] }[] = [
  { keys: ['G'], label: 'Generate' },
  { keys: ['0-9'], label: 'Re-roll the word with that number' },
  { keys: ['Shift', '0-9'], label: 'Lock or unlock that slot', tabs: ['character'] },
  { keys: ['N'], label: 'Create narrative or sketch' },
  { keys: ['W'], label: 'Jump to the page and write' },
  { keys: ['T'], label: 'Start or stop the timer' },
  { keys: ['F'], label: 'Focus mode' },
  { keys: ['A'], label: 'Archive' },
  { keys: ['Esc'], label: 'Leave the page, close, or exit focus' },
];

/** The keyboard map. Shown in the margin before the first roll and in the Keys popover. */
export default function KeysList({ tab, compact = false }: { tab: Tab; compact?: boolean }) {
  const rows = KEYS.filter((k) => !k.tabs || k.tabs.includes(tab));
  return (
    <div className={`tool keys-list ${compact ? 'only-fine' : ''}`}>
      <div className="tool-label">Keys</div>
      <dl>
        {rows.map((r) => (
          <div key={r.label} className="keys-row">
            <dt>
              {r.keys.map((k, i) => (
                <span key={k}>
                  {i > 0 && <span className="keys-sep">+</span>}
                  <kbd className="kbd">{k}</kbd>
                </span>
              ))}
            </dt>
            <dd>{r.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
