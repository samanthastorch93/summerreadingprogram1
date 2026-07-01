import { Sun } from 'lucide-react';

// Maps each brand background color to a guaranteed-contrasting icon color
const ICON_COLOR_MAP: Record<string, string> = {
  '#0F00E3': '#FFC400', // blue bg → yellow icon
  '#E30D00': '#FFC400', // red bg → yellow icon
  '#FFC400': '#0F00E3', // yellow bg → blue icon
  '#FFE3E3': '#E30D00', // pink bg → red icon
  '#E3FAFF': '#0F00E3', // sky bg → blue icon
};

const SIZES: Record<string, { outer: string; iconPx: number }> = {
  xs: { outer: 'w-4 h-4',   iconPx: 8  },
  sm: { outer: 'w-6 h-6',   iconPx: 12 },
  md: { outer: 'w-7 h-7',   iconPx: 14 },
  lg: { outer: 'w-9 h-9',   iconPx: 18 },
  xl: { outer: 'w-16 h-16', iconPx: 28 },
};

interface Props {
  avatarColor: string;
  userId?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export default function AvatarIcon({ avatarColor, size = 'md', className = '' }: Props) {
  const { outer, iconPx } = SIZES[size];
  const iconColor = ICON_COLOR_MAP[avatarColor] ?? '#FFFFFF';
  return (
    <div
      className={`${outer} flex items-center justify-center shrink-0 ${className}`}
      style={{ backgroundColor: avatarColor }}
    >
      <Sun size={iconPx} strokeWidth={2} color={iconColor} />
    </div>
  );
}
