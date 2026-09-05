// Pagination sous forme de segments numérotés, pour une longue liste
// groupée par date — l'alternative choisie à une grille ou un défilement
// mois par mois.
export default function PageTabs({ total, page, onChange }) {
  if (total <= 1) return null;
  return (
    <div className="page-tabs" role="tablist" aria-label="Page">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={page === i}
          className={page === i ? 'page-tab active' : 'page-tab'}
          onClick={() => onChange(i)}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}
