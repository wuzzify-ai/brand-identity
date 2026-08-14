type Props = {
  product?: string;
};

export function WuzzifyBrand({ product = "Brand Studio" }: Props) {
  return (
    <span className="wuzzify-brand" aria-label={`Wuzzify ${product}`}>
      <svg
        className="wuzzify-mark"
        viewBox="0 0 122 87"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="0" y="0" width="25" height="64" rx="1.5" />
        <rect x="49" y="0" width="24" height="64" rx="1.5" />
        <rect x="98" y="21" width="24" height="43" rx="1.5" />
        <polygon points="18,66 48,66 48,87 27,87" />
        <polygon points="66,66 97,66 97,87 76,87" />
      </svg>
      <span className="wuzzify-brand-copy">
        <span className="wuzzify-wordmark">WUZZIFY</span>
        <span className="wuzzify-product">{product}</span>
      </span>
    </span>
  );
}
