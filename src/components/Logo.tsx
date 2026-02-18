import { Receipt } from "lucide-react";

interface LogoProps {
  className?: string;
  showText?: boolean;
  iconSize?: number;
}

export function Logo({ className = "", showText = true, iconSize = 28 }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Receipt size={iconSize} strokeWidth={2} className="shrink-0" />
      {showText && (
        <span className="text-xl font-bold tracking-tight">Recibos de Sueldos</span>
      )}
    </div>
  );
}
