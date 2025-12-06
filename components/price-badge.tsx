import { Badge } from "./ui/badge";
import { formatPrice } from "@/lib/utils";

interface PriceBadgeProps {
  price: number | string;
  variant?: "default" | "success" | "warning" | "destructive";
}

export function PriceBadge({ price, variant = "default" }: PriceBadgeProps) {
  return (
    <Badge variant={variant} className="text-base px-3 py-1">
      {formatPrice(price)}
    </Badge>
  );
}




