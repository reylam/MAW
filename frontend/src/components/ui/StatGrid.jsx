import StatCell from './StatCell';

/*
  A row of metric cells with clean hairline separators that stay correct when
  the grid wraps on small screens. We use a 1px gap over a tinted background so
  every seam is drawn by the background showing through — no doubled borders at
  wrap points. Meant to sit inside a Card (which supplies the outer border).
*/
export default function StatGrid({ items, cols = 4 }) {
  const colClass =
    cols === 5
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
      : cols === 3
      ? 'grid-cols-3'
      : 'grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${colClass} gap-px bg-maw-border-subtle overflow-hidden rounded-maw`}>
      {items.map((item) => (
        <div key={item.label} className="p-4 sm:p-5 bg-maw-card">
          <StatCell {...item} />
        </div>
      ))}
    </div>
  );
}
