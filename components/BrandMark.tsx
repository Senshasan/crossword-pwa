// A 3×3 crossword: two blocks, and the first square in coral ("one square at a time").
// Same drawing as public/icon.svg; fixed colours so it reads identically in both themes.
export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  const cells: [number, number, string][] = [
    [0, 0, "#e9805d"],
    [0, 1, "#fffefb"],
    [1, 0, "#fffefb"],
    [1, 1, "#fffefb"],
    [1, 2, "#fffefb"],
    [2, 1, "#fffefb"],
    [2, 2, "#fffefb"],
  ];
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <rect width="32" height="32" rx="9" fill="#587463" />
        {cells.map(([r, c, fill]) => (
          <rect key={`${r}${c}`} x={6 + c * 7} y={6 + r * 7} width="6" height="6" rx="1.25" fill={fill} />
        ))}
      </svg>
    </span>
  );
}
