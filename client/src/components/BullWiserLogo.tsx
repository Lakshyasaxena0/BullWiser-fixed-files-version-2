interface BullWiserLogoProps {
  className?: string;
}

export function BullWiserLogo({ className = "w-10 h-10" }: BullWiserLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="BullWiser Logo"
      className={`object-contain ${className}`}
    />
  );
}
