/*
  Base surface used across the app. One border treatment, one radius,
  one restrained shadow — so every panel reads as the same system.
*/
export function Card({ as: Tag = 'div', className = '', children, interactive = false, ...rest }) {
  return (
    <Tag
      className={`bg-maw-card border border-maw-border rounded-maw shadow-maw-sm ${
        interactive ? 'transition-colors hover:border-maw-border-strong' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Section header inside a card: title left, optional action right. */
export function CardHeader({ title, eyebrow, icon: Icon, action, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-maw-border-subtle ${className}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon size={16} className="text-maw-text-subtle shrink-0" />}
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h3 className="font-display font-semibold text-maw-text-main text-sm sm:text-[15px] truncate">{title}</h3>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
}

export default Card;
