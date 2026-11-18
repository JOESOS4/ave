import { useMemo, useState } from "react";
import { ArrowUp, File, FolderOpen, Settings2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocaleFormatting } from "@/shared/i18n";
import { useSessionCostPreference } from "@/features/chat/lib/sessionCostPreference";
import { IconPlayerStopFilled } from "@tabler/icons-react";
import { cn } from "@/shared/lib/cn";
import { ContextRing } from "./ContextRing";
import { Button } from "@/shared/ui/button";
import { ComposerActionButton } from "@/shared/ui/composer-action-button";
import { DictationMicButton } from "./DictationMicButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Progress } from "@/shared/ui/progress";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/shared/ui/tooltip";
import { Kbd } from "@/shared/ui/kbd";
import { AgentModelPicker } from "./AgentModelPicker";
import { formatProviderLabel } from "@/shared/ui/icons/ProviderIcons";
import { getCatalogEntryFromEntries } from "@/features/providers/providerCatalog";
import { useProviderCatalogStore } from "@/features/providers/stores/providerCatalogStore";
import { supportsContextCompactionControls } from "../lib/autoCompact";
import { requestOpenSettings } from "@/features/settings/lib/settingsEvents";
import { ProjectInputSelector } from "./ProjectInputSelector";
import { RemoteDirectoryPicker } from "./RemoteDirectoryPicker";
import { RemoteHostSelector } from "./RemoteHostSelector";
import type {
  AgentPickerOption,
  ChatInputAgentModelPicker,
  ChatInputContextUsage,
  ChatInputProjectPicker,
  ChatInputReasoningEffort,
  ChatInputRemoteHostPicker,
  ChatInputVoiceConversation,
} from "../types";

interface ChatInputToolbarComposerActions {
  canSend: boolean;
  /** When false, the send button stays collapsed so the mic is the only right-hand action. */
  hasComposerText?: boolean;
  isStreaming: boolean;
  onSend: () => void;
  onStop?: () => void;
  onAttachFiles?: () => void;
  onAttachFolders?: () => void;
  attachmentsEnabled?: boolean;
  disabled?: boolean;
  sendDisabledReason?: string;
  voiceEnabled?: boolean;
  voiceStarting?: boolean;
  voiceRecording?: boolean;
  voiceTranscribing?: boolean;
  voiceShortcutDisplayParts?: string[];
  onVoiceToggle?: () => void;
  voiceConversation?: ChatInputVoiceConversation;
}

type OpenToolbarMenu =
  | "attachments"
  | "model"
  | "project"
  | "remoteHost"
  | "remoteDir"
  | "context";

interface ChatInputToolbarProps {
  agentModelPicker: ChatInputAgentModelPicker & { enabled?: boolean };
  reasoningEffort?: ChatInputReasoningEffort;
  projectPicker: ChatInputProjectPicker;
  remoteHostPicker?: ChatInputRemoteHostPicker;
  contextUsage: ChatInputContextUsage;
  composerActions: ChatInputToolbarComposerActions;
  onRequestComposerFocus?: () => void;
  isCompact: boolean;
}

export function ChatInputToolbar({
  agentModelPicker,
  reasoningEffort,
  projectPicker,
  remoteHostPicker,
  contextUsage,
  composerActions,
  onRequestComposerFocus,
  isCompact,
}: ChatInputToolbarProps) {
  const { t } = useTranslation("chat");
  const { formatNumber } = useLocaleFormatting();
  const catalogEntries = useProviderCatalogStore((state) => state.entries);
  const [openMenu, setOpenMenu] = useState<OpenToolbarMenu | null>(null);
  const handleMenuOpenChange = (menu: OpenToolbarMenu) => (open: boolean) => {
    setOpenMenu((current) => (open ? menu : current === menu ? null : current));
  };
  const isContextPopoverOpen = openMenu === "context";
  const {
    providers = [],
    providersLoading,
    selectedProvider = "goose",
    onProviderChange,
    currentModelId,
    currentModelProviderId,
    currentModel,
    availableModels = [],
    favoriteModels,
    modelsLoading = false,
    modelStatusMessage = null,
    onModelChange,
    onPickerOpen,
    providerColumnMode,
    autoRouting,
    enabled: agentModelPickerEnabled = true,
  } = agentModelPicker;
  const {
    enabled: projectPickerEnabled = true,
    selectedProjectId = null,
    availableProjects = [],
    onProjectChange,
    onCreateProject,
  } = projectPicker;
  const remoteHostPickerEnabled = remoteHostPicker?.enabled === true;
  // A started remote session keeps showing its host (selection disabled):
  // the composer must always tell the user where their commands will run.
  const selectedRemoteHost = remoteHostPicker?.selectedHost ?? null;
  const {
    contextTokens = 0,
    contextLimit = 0,
    accumulatedCost = null,
    isContextUsageReady,
    supportsCompactionControls,
    canCompactContext = false,
    isCompactingContext = false,
    onCompactContext,
  } = contextUsage;
  const {
    canSend,
    hasComposerText = false,
    isStreaming,
    onSend,
    onStop,
    onAttachFiles,
    onAttachFolders,
    attachmentsEnabled = true,
    disabled = false,
    sendDisabledReason,
    voiceEnabled = false,
    voiceRecording = false,
    voiceTranscribing = false,
    voiceShortcutDisplayParts,
    onVoiceToggle,
    voiceConversation,
  } = composerActions;
  const compactionControlsSupported =
    supportsCompactionControls ??
    supportsContextCompactionControls(selectedProvider);
  const showSendAction = isStreaming || hasComposerText || canSend;
  const sendButtonTooltip = canSend
    ? t("toolbar.sendMessage")
    : sendDisabledReason;
  const voiceConversationState = voiceConversation?.state ?? "off";
  const voiceConversationRunning = voiceConversation?.active === true;
  // Conversation mode is not a composer affordance. Keep its lifecycle out of
  // the toolbar so the phone control cannot appear beside dictation.
  const voiceInputTooltip = voiceRecording
    ? t("toolbar.voiceInputRecording")
    : voiceTranscribing
      ? t("toolbar.voiceInputTranscribing")
      : t("toolbar.voiceInput");
  const nativeVoiceOwnsMicrophone =
    voiceConversationState === "starting" ||
    voiceConversationState === "stopping" ||
    voiceConversationRunning;
  const agentProviders = useMemo(() => {
    const seen = new Set<string>();
    const available: AgentPickerOption[] = [];
    for (const provider of providers) {
      if (seen.has(provider.id)) {
        continue;
      }
      seen.add(provider.id);
      available.push({
        ...provider,
        label:
          getCatalogEntryFromEntries(catalogEntries, provider.id)
            ?.displayName ?? provider.label,
      });
    }
    if (available.length > 0) return available;
    return [
      {
        id: selectedProvider,
        label:
          getCatalogEntryFromEntries(catalogEntries, selectedProvider)
            ?.displayName ?? formatProviderLabel(selectedProvider),
      },
    ];
  }, [catalogEntries, providers, selectedProvider]);
  const contextProgress =
    contextLimit > 0 ? Math.min(contextTokens / contextLimit, 1) : 0;
  const showContextUsage =
    (isContextUsageReady ?? contextLimit > 0) && contextTokens > 0;
  const contextPercentDigits =
    contextProgress > 0 && contextProgress < 0.1 ? 1 : 0;
  const usedPercentLabel = formatNumber(contextProgress, {
    style: "percent",
    minimumFractionDigits: contextPercentDigits,
    maximumFractionDigits: contextPercentDigits,
  });
  const formatCompactTokenCount = (value: number) =>
    formatNumber(value, {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: value < 10_000 ? 1 : 0,
    });
  const sessionCostPreference = useSessionCostPreference();
  const showSessionCost = sessionCostPreference.enabled;
  const hasCost =
    showSessionCost &&
    typeof accumulatedCost === "number" &&
    Number.isFinite(accumulatedCost);
  const formatCurrency = (value: number) =>
    formatNumber(value, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  // A nonzero cost that rounds below one cent (e.g. $0.004) would otherwise
  // render as "$0.00" and read as free. Show it as "<$0.01" so a real cost is
  // never displayed as zero.
  const costLabel = !hasCost
    ? null
    : (accumulatedCost as number) > 0 && (accumulatedCost as number) < 0.005
      ? `<${formatCurrency(0.01)}`
      : formatCurrency(accumulatedCost as number);

  const handleCompactContext = () => {
    if (!canCompactContext || isCompactingContext || !onCompactContext) {
      return;
    }

    setOpenMenu(null);
    void onCompactContext();
  };

  const handleOpenAutoCompactSettings = () => {
    setOpenMenu(null);
    // Auto-compact settings live in the Behavior section (BOT-1430 redesign,
    // "chat" was renamed "behavior" -- see settingsSections.ts).
    requestOpenSettings("behavior");
  };

  if (!showContextUsage && isContextPopoverOpen) {
    setOpenMenu(null);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2",
        isCompact && "flex-wrap gap-y-2",
      )}
    >
      {/* Left side: pickers */}
      <div
        className={cn("flex min-w-0 items-center gap-2", isCompact && "flex-1")}
      >
        {attachmentsEnabled && (
          <DropdownMenu
            modal={false}
            open={openMenu === "attachments"}
            onOpenChange={handleMenuOpenChange("attachments")}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <ComposerActionButton
                    type="button"
                    size="icon-pill-sm"
                    disabled={disabled}
                    aria-label={t("toolbar.attach")}
                  >
                    <Plus aria-hidden="true" />
                  </ComposerActionButton>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("toolbar.attach")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={() => onAttachFiles?.()}
                disabled={disabled || Boolean(selectedRemoteHost)}
              >
                <File className="mr-2 h-4 w-4" />
                {t("toolbar.attachFile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onAttachFolders?.()}
                // Local path attachments are meaningless for a session that
                // runs its backend on a remote host.
                disabled={disabled || Boolean(selectedRemoteHost)}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {t("toolbar.attachFolder")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {agentModelPickerEnabled &&
          (agentProviders.length > 0 || providersLoading) && (
            <AgentModelPicker
              autoRouting={autoRouting}
              agents={agentProviders}
              selectedAgentId={selectedProvider}
              onAgentChange={(providerId) => onProviderChange?.(providerId)}
              currentModelId={currentModelId}
              currentModelProviderId={currentModelProviderId}
              currentModelName={currentModel ?? null}
              availableModels={availableModels}
              favoriteModels={favoriteModels}
              modelsLoading={modelsLoading}
              modelStatusMessage={modelStatusMessage}
              onModelChange={onModelChange}
              open={openMenu === "model"}
              onOpen={onPickerOpen}
              onOpenChange={handleMenuOpenChange("model")}
              onRequestComposerFocus={onRequestComposerFocus}
              loading={providersLoading}
              isCompact={isCompact}
              triggerIconOnly={isCompact}
              reasoningEffort={reasoningEffort}
              providerColumnMode={providerColumnMode}
            />
          )}

        {projectPickerEnabled ? (
          <ProjectInputSelector
            selectedProjectId={selectedProjectId}
            availableProjects={availableProjects}
            onProjectChange={onProjectChange}
            onCreateProject={onCreateProject}
            open={openMenu === "project"}
            onOpenChange={handleMenuOpenChange("project")}
            onRequestComposerFocus={onRequestComposerFocus}
            modal={false}
            triggerIconOnly={isCompact}
          />
        ) : null}

        {remoteHostPickerEnabled || selectedRemoteHost ? (
          <RemoteHostSelector
            selectedHost={selectedRemoteHost}
            hosts={remoteHostPicker?.hosts}
            onHostChange={remoteHostPicker?.onHostChange}
            open={openMenu === "remoteHost"}
            onOpenChange={handleMenuOpenChange("remoteHost")}
            onRequestComposerFocus={onRequestComposerFocus}
            modal={false}
            triggerIconOnly={isCompact}
            disabled={!remoteHostPickerEnabled}
          />
        ) : null}

        {remoteHostPickerEnabled && selectedRemoteHost ? (
          <RemoteDirectoryPicker
            host={selectedRemoteHost}
            selectedDir={remoteHostPicker?.selectedDir ?? null}
            onDirChange={remoteHostPicker?.onDirChange}
            open={openMenu === "remoteDir"}
            onOpenChange={handleMenuOpenChange("remoteDir")}
            triggerIconOnly={isCompact}
          />
        ) : null}
      </div>

      {/* Right side: actions */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2",
          isCompact && "ml-auto",
        )}
      >
        <div className="flex items-center gap-2">
          {showContextUsage && (
            <Popover
              open={isContextPopoverOpen}
              onOpenChange={handleMenuOpenChange("context")}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size={isCompact ? "icon-sm" : "sm"}
                      className={cn(
                        "group rounded-sm bg-transparent text-foreground/80 shadow-none hover:bg-transparent hover:text-foreground data-[state=open]:bg-transparent data-[state=open]:text-foreground",
                        isCompact ? "px-0" : "px-2.5",
                      )}
                      aria-label={
                        costLabel
                          ? t("toolbar.contextUsageWithCost", {
                              cost: costLabel,
                            })
                          : t("toolbar.contextUsage")
                      }
                    >
                      <ContextRing
                        tokens={contextTokens}
                        limit={contextLimit}
                        size={16}
                      />
                      {!isCompact && costLabel ? (
                        <span className="ml-1.5 text-xs tabular-nums">
                          {costLabel}
                        </span>
                      ) : null}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {t("toolbar.contextUsageTitle", {
                    tokens: formatNumber(contextTokens),
                    limit: formatNumber(contextLimit),
                  })}
                </TooltipContent>
              </Tooltip>
              <PopoverContent
                side="top"
                align="end"
                sideOffset={8}
                className="w-60 rounded-md p-1 text-left"
              >
                <div className="px-2 py-1.5 text-sm font-semibold text-foreground">
                  {t("toolbar.contextWindow")}
                </div>
                <div className="space-y-2 px-2 pb-1.5">
                  <Progress
                    className="h-1.5 bg-muted"
                    value={contextProgress * 100}
                  />
                  <div className="flex items-center justify-between gap-3 text-xs text-foreground">
                    <div className="truncate">
                      {t("toolbar.contextTokensBreakdown", {
                        tokens: formatCompactTokenCount(contextTokens),
                        limit: formatCompactTokenCount(contextLimit),
                      })}
                    </div>
                    <div className="shrink-0">{usedPercentLabel}</div>
                  </div>
                  {costLabel ? (
                    <div className="flex items-center justify-between gap-3 text-xs text-foreground">
                      <div className="truncate text-muted-foreground">
                        {t("toolbar.sessionCost")}
                      </div>
                      <div className="shrink-0 tabular-nums">{costLabel}</div>
                    </div>
                  ) : null}
                  {compactionControlsSupported ? (
                    <div className="flex items-center gap-1 pt-0.5">
                      <Button
                        type="button"
                        variant="subtle"
                        size="xs"
                        className="min-w-0 flex-1 justify-center"
                        onClick={handleCompactContext}
                        disabled={!canCompactContext || isCompactingContext}
                      >
                        {isCompactingContext
                          ? t("toolbar.compacting")
                          : t("toolbar.compactNow")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 rounded-sm"
                        onClick={handleOpenAutoCompactSettings}
                        aria-label={t("toolbar.settings")}
                        tooltip={t("toolbar.settings")}
                      >
                        <Settings2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <DictationMicButton
            isRecording={voiceRecording}
            isTranscribing={voiceTranscribing}
            disabled={nativeVoiceOwnsMicrophone || disabled}
            onClick={onVoiceToggle ?? (() => {})}
            ariaLabel={
              voiceRecording
                ? t("toolbar.voiceInputRecording")
                : t("toolbar.voiceInput")
            }
            tooltip={
              !voiceEnabled ? (
                t("toolbar.voiceInputDisabled")
              ) : !voiceRecording &&
                !voiceTranscribing &&
                voiceShortcutDisplayParts?.length ? (
                <span className="flex items-center gap-2">
                  <span>{voiceInputTooltip}</span>
                  <span className="flex items-center gap-1">
                    {voiceShortcutDisplayParts.map((part) => (
                      <Kbd key={part}>{part}</Kbd>
                    ))}
                  </span>
                </span>
              ) : (
                voiceInputTooltip
              )
            }
          />

          <div
            className={cn(
              "overflow-hidden transition-[width,opacity,transform] duration-200 ease-out",
              showSendAction
                ? "w-7 translate-x-0 opacity-100"
                : "pointer-events-none w-0 translate-x-2 opacity-0",
            )}
          >
          {isStreaming && onStop ? (
            <ComposerActionButton
              type="button"
              onClick={onStop}
              size="icon-pill-sm"
              aria-label={t("toolbar.stopGeneration")}
              tooltip={t("toolbar.stopGeneration")}
            >
              <IconPlayerStopFilled className="size-3.5" aria-hidden="true" />
            </ComposerActionButton>
          ) : !sendButtonTooltip ? (
            <ComposerActionButton
              type="button"
              onClick={onSend}
              disabled={!canSend}
              size="icon-pill-sm"
              className={cn(!canSend && "disabled:opacity-100")}
              aria-label={t("toolbar.sendMessage")}
            >
              <ArrowUp aria-hidden="true" />
            </ComposerActionButton>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <ComposerActionButton
                    type="button"
                    onClick={onSend}
                    disabled={!canSend}
                    size="icon-pill-sm"
                    className={cn(!canSend && "disabled:opacity-100")}
                    aria-label={sendButtonTooltip ?? t("toolbar.sendMessage")}
                  >
                    <ArrowUp aria-hidden="true" />
                  </ComposerActionButton>
                </span>
              </TooltipTrigger>
              {sendButtonTooltip ? (
                <TooltipContent>{sendButtonTooltip}</TooltipContent>
              ) : null}
            </Tooltip>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
