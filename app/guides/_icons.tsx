import {
  Droplet,
  Droplets,
  Thermometer,
  Disc,
  Battery,
  Lightbulb,
  Wind,
  Filter,
  Cog,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

/** Ключ icon из lib/guides.ts → компонент иконки. */
export const GUIDE_ICONS: Record<string, LucideIcon> = {
  droplet: Droplet,
  droplets: Droplets,
  thermometer: Thermometer,
  disc: Disc,
  battery: Battery,
  lightbulb: Lightbulb,
  wind: Wind,
  filter: Filter,
  cog: Cog,
};

export function guideIcon(key: string): LucideIcon {
  return GUIDE_ICONS[key] ?? BookOpen;
}
