/*
  Consistent page title block. Keeps type hierarchy identical on every route
  so the app feels like one product rather than a set of templates.
*/
export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="text-xl sm:text-2xl font-display font-bold text-maw-text-main tracking-tight">{title}</h1>
        {description && <p className="text-sm text-maw-text-muted mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
