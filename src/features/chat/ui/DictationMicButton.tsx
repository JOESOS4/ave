import { Mic, Square } from "lucide-react";
import { ComposerActionButton } from "@/shared/ui/composer-action-button";

interface DictationMicButtonProps {
  isRecording: boolean;
  isTranscribing: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
  tooltip?: React.ReactNode;
  size?: "icon-pill-sm" | "icon-sm";
}

/**
 * Mic button that shows a simple waveform when recording.
 * Uses the existing ComposerActionButton so it stays on the design system.
 */
export function DictationMicButton({
  isRecording,
  isTranscribing,
  disabled,
  onClick,
  ariaLabel,
  tooltip,
  size = "icon-pill-sm",
}: DictationMicButtonProps) {
  const visualState = isRecording ? "active" : undefined;

  return (
    <ComposerActionButton
      type="button"
      size={size}
      visualState={visualState}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isRecording}
      tooltip={tooltip}
      className={isRecording ? "bg-destructive/10 text-destructive" : ""}
    >
      {isRecording ? (
        <div className="flex items-center gap-0.5 h-3.5 px-1">
          <div className="w-0.5 h-1 bg-current rounded animate-pulse" />
          <div className="w-0.5 h-2.5 bg-current rounded animate-[pulse_400ms_ease-in-out_infinite]" />
          <div className="w-0.5 h-1.5 bg-current rounded animate-[pulse_300ms_ease-in-out_infinite]" />
          <div className="w-0.5 h-2 bg-current rounded animate-[pulse_500ms_ease-in-out_infinite]" />
        </div>
      ) : isTranscribing ? (
        <Square className="size-3.5" />
      ) : (
        <Mic className="size-3.5" />
      )}
    </ComposerActionButton>
  );
}
