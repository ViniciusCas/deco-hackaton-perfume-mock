export interface Props {
  title: string;
}

export default function ProductCardTitle({ title }: Props) {
  return (
    <span className="line-clamp-1 font-display text-base font-medium text-ink-soft">{title}</span>
  );
}
