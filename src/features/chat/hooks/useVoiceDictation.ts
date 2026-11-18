import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { create } from "zustand";
import { useProfileCapability } from "@/shared/profile/capabilities";
import { isPromiseLike } from "@/shared/lib/isPromiseLike";
import type { ChatAttachmentDraft } from "@/shared/types/messages";
import { useOpenAiRealtimeDictation } from "./useOpenAiRealtimeDictation";
import {
  DEFAULT_AUTO_SUBMIT_PHRASES_RAW,
  getAutoSubmitMatch,
  parseAutoSubmitPhrases,
  replaceTrailingTranscribedText,
} from "../lib/voiceInput";

interface DictationOwnershipState {
  activeInstanceIds: Set<string>;
  setActive: (instanceId: string, active: boolean) => void;
}

const useDictationOwnershipStore = create<DictationOwnershipState>((set) => ({
  activeInstanceIds: new Set(),
  setActive: (instanceId, active) =>
    set((state) => {
      const activeInstanceIds = new Set(state.activeInstanceIds);
      if (active) activeInstanceIds.add(instanceId);
      else activeInstanceIds.delete(instanceId);
      return { activeInstanceIds };
    }),
}));

export function useAnyVoiceDictationActive(): boolean {
  return useDictationOwnershipStore(
    (state) => state.activeInstanceIds.size > 0,
  );
}

interface UseVoiceDictationOptions {
  text: string;
  setText: (value: string) => void;
  attachments: ChatAttachmentDraft[];
  clearAttachments: () => void;
  selectedPersonaId: string | null;
  onSend: (
    text: string,
    personaId?: string | null,
    attachments?: ChatAttachmentDraft[],
  ) => boolean | Promise<boolean>;
  onAutoSubmit?: (text: string) => boolean | Promise<boolean>;
  resetTextarea: () => void;
  isSendLocked?: boolean;
}

export function useVoiceDictation({
  text,
  setText,
  attachments,
  clearAttachments,
  selectedPersonaId,
  onSend,
  onAutoSubmit,
  resetTextarea,
  isSendLocked = false,
}: UseVoiceDictationOptions) {
  const autoSubmitPhrases = useMemo(
    () => parseAutoSubmitPhrases(DEFAULT_AUTO_SUBMIT_PHRASES_RAW),
    [],
  );
  const stopRecordingRef = useRef<() => void>(() => {});
  const textRef = useRef(text);
  textRef.current = text;
  const lastRealtimeTranscriptRef = useRef("");

  const finishAutoSubmit = useCallback(
    (merged: string) => {
      if (isSendLocked) {
        setText(merged);
        textRef.current = merged;
        return;
      }

      const sendResult = onAutoSubmit
        ? onAutoSubmit(merged.trim())
        : onSend(
            merged.trim(),
            selectedPersonaId,
            attachments.length > 0 ? attachments : undefined,
          );

      if (isPromiseLike<boolean>(sendResult)) {
        void sendResult
          .then((accepted) => {
            if (accepted === false) {
              setText(merged);
              textRef.current = merged;
              return;
            }
            setText("");
            textRef.current = "";
            lastRealtimeTranscriptRef.current = "";
            clearAttachments();
            resetTextarea();
          })
          .catch(() => {
            setText(merged);
            textRef.current = merged;
          });
        return;
      }

      if (sendResult === false) {
        setText(merged);
        textRef.current = merged;
        return;
      }

      setText("");
      textRef.current = "";
      lastRealtimeTranscriptRef.current = "";
      clearAttachments();
      resetTextarea();
    },
    [
      attachments,
      clearAttachments,
      isSendLocked,
      onAutoSubmit,
      onSend,
      resetTextarea,
      selectedPersonaId,
      setText,
    ],
  );

  const handleRealtimeTranscript = useCallback(
    (transcript: string, isFinal = true) => {
      // Only commit to the draft when the segment is final.
      // This makes dictation edit-safe: the user can type while the mic is hot.
      if (!isFinal) {
        // Future: expose pending tail for grey rendering
        return;
      }

      const previousTranscript = lastRealtimeTranscriptRef.current;
      const latest = textRef.current;
      const merged = replaceTrailingTranscribedText(
        latest,
        previousTranscript,
        transcript,
      );
      const match = getAutoSubmitMatch(transcript, autoSubmitPhrases);

      if (!match) {
        setText(merged);
        textRef.current = merged;
        lastRealtimeTranscriptRef.current = transcript;
        return;
      }

      const textWithoutPhrase = replaceTrailingTranscribedText(
        latest,
        previousTranscript,
        match.textWithoutPhrase,
      );
      if (!textWithoutPhrase.trim()) {
        return;
      }

      stopRecordingRef.current();
      finishAutoSubmit(textWithoutPhrase);
    },
    [autoSubmitPhrases, finishAutoSubmit, setText],
  );

  const voiceDictationEnabled = useProfileCapability("voiceDictation");

  const dictation = useOpenAiRealtimeDictation({
    disabled: !voiceDictationEnabled,
    onRecordingStart: () => {
      lastRealtimeTranscriptRef.current = "";
    },
    onTranscriptText: handleRealtimeTranscript,
  });
  stopRecordingRef.current = dictation.stopRecording;

  const ownershipInstanceId = useId();
  const setDictationActive = useDictationOwnershipStore(
    (state) => state.setActive,
  );
  const ownsMicrophone =
    dictation.isStarting() || dictation.isRecording || dictation.isTranscribing;
  useEffect(() => {
    setDictationActive(ownershipInstanceId, ownsMicrophone);
    return () => setDictationActive(ownershipInstanceId, false);
  }, [ownershipInstanceId, ownsMicrophone, setDictationActive]);

  return {
    ...dictation,
    isEnabled: voiceDictationEnabled && dictation.isEnabled,
  };
}
