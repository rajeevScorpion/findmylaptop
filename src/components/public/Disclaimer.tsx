interface DisclaimerProps {
  text?: string;
}

const DEFAULT_TEXT =
  "Prices are approximate and change frequently. Affiliate links may earn a small commission at no extra cost to the buyer. Recommendations are educational and based on design workload suitability. Please verify specifications, warranty, seller reputation, return policy, and price before purchasing. No exclusive endorsement of any brand.";

export function Disclaimer({ text }: DisclaimerProps) {
  return (
    <footer className="px-4 py-8 border-t border-border/20 mt-4">
      <div className="max-w-3xl mx-auto text-center space-y-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {text ?? DEFAULT_TEXT}
        </p>
        <p className="text-xs text-muted-foreground/60">
          Find My Laptop — Design Course Laptop Recommender
        </p>
      </div>
    </footer>
  );
}
