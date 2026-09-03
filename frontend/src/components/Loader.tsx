export function Loader({ label }: { label: string }) {
  return <span className="loader" role="status" aria-label={label}><span className="visually-hidden">{label}</span></span>;
}
