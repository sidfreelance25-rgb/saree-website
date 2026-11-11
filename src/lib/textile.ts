export type TextilePattern = "buti" | "stripe" | "check" | "paisley" | "temple" | "plain";

export function sareeSvg(input: {
  ground: string;
  border: string;
  motif: string;
  accent: string;
  pattern: TextilePattern;
}) {
  const motifs: string[] = [];
  if (input.pattern === "buti") {
    for (let y = 110; y < 400; y += 38) {
      for (let x = 36; x < 270; x += 38) {
        motifs.push(`<circle cx="${x}" cy="${y}" r="2.4" fill="${input.motif}"/>`);
        motifs.push(
          `<path d="M${x} ${y - 8} C${x + 6} ${y - 2}, ${x + 4} ${y + 4}, ${x} ${y + 7} C${x - 4} ${y + 4}, ${x - 6} ${y - 2}, ${x} ${y - 8}Z" fill="${input.motif}" opacity="0.85"/>`,
        );
      }
    }
  } else if (input.pattern === "stripe") {
    for (let x = 24; x < 286; x += 18) {
      motifs.push(`<rect x="${x}" y="78" width="4" height="382" fill="${input.motif}" opacity="0.8"/>`);
    }
  } else if (input.pattern === "check") {
    for (let y = 90; y < 450; y += 22) {
      motifs.push(`<rect x="14" y="${y}" width="272" height="2" fill="${input.motif}" opacity="0.7"/>`);
    }
    for (let x = 28; x < 286; x += 22) {
      motifs.push(`<rect x="${x}" y="78" width="2" height="382" fill="${input.motif}" opacity="0.7"/>`);
    }
  } else if (input.pattern === "paisley") {
    for (let y = 120; y < 400; y += 70) {
      for (let x = 48; x < 260; x += 70) {
        motifs.push(
          `<path d="M${x} ${y} C${x + 18} ${y - 20}, ${x + 28} ${y + 8}, ${x + 8} ${y + 22} C${x - 8} ${y + 12}, ${x - 10} ${y + 4}, ${x} ${y}Z" fill="${input.motif}"/>`,
        );
      }
    }
  } else if (input.pattern === "temple") {
    for (let x = 28; x < 280; x += 28) {
      motifs.push(
        `<path d="M${x} 150 L${x + 12} 126 L${x + 24} 150 L${x + 18} 150 L${x + 18} 168 L${x + 6} 168 L${x + 6} 150 Z" fill="${input.motif}"/>`,
      );
    }
    for (let y = 190; y < 420; y += 46) {
      motifs.push(`<rect x="20" y="${y}" width="260" height="3" fill="${input.border}" opacity="0.55"/>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 460" role="img">
  <rect width="300" height="460" fill="${input.ground}"/>
  <rect width="300" height="86" fill="${input.border}"/>
  <rect y="78" width="300" height="8" fill="${input.accent}"/>
  <rect width="16" height="460" fill="${input.border}"/>
  <rect x="284" width="16" height="460" fill="${input.border}"/>
  ${motifs.join("\n")}
  <rect x="196" y="392" width="78" height="50" fill="${input.accent}" stroke="${input.border}" stroke-width="2"/>
  <text x="235" y="421" text-anchor="middle" font-size="9" fill="${input.ground}" font-family="Georgia, serif">blouse</text>
</svg>`;
}
