import {
  Droplet,
  Thermometer,
  Disc,
  Battery,
  Lightbulb,
  Wind,
  Filter,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

/** Ключ icon из lib/guides.ts → компонент иконки. */
export const GUIDE_ICONS: Record<string, LucideIcon> = {
  droplet: Droplet,
  thermometer: Thermometer,
  disc: Disc,
  battery: Battery,
  lightbulb: Lightbulb,
  wind: Wind,
  filter: Filter,
};

export function guideIcon(key: string): LucideIcon {
  return GUIDE_ICONS[key] ?? BookOpen;
}
