import { cn } from "@/lib/utils";

interface ProgressIndicatorProps {
  progress: number;
  className?: string;
}

export default function ProgressIndicator({ progress, className }: ProgressIndicatorProps) {
  return (
    <div className={cn("w-full bg-secondary rounded-full h-2", className)} data-testid="progress-container">
      <div 
        className="progress-bar h-2 rounded-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-300 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        data-testid="progress-bar"
      />
    </div>
  );
}
