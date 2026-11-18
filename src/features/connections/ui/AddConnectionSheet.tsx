import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { IconPlus, IconRobot } from "@tabler/icons-react";
import {
  addLocalMcp,
  listConnections,
  type AddLocalMcpRequest,
} from "@/features/connections/api/connections";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { OAUTH_PROVIDERS } from "@/features/connections/catalog";
import { resolveConnectionStatus } from "@/features/connections/lib/connectionStatus";
import {
  useExtensionModalForm,
  type ExtensionModalType,
} from "@/features/extensions/hooks/useExtensionModalForm";
import { OAuthConnectionCard } from "./ConnectionCards";
import type { SetupChatRequest } from "@/features/chat/lib/setupChatRequest";

export interface AddConnectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAskAgent: (request: SetupChatRequest) => void;
}

export function AddConnectionSheet({
  open,
  onOpenChange,
  onAskAgent,
}: AddConnectionSheetProps) {
  const { t } = useTranslation("settings");
  const [tab, setTab] = useState<"catalog" | "custom" | "other">("catalog");

  const managedQuery = useQuery({
    queryKey: ["connections"],
    queryFn: listConnections,
    enabled: open,
  });

  const connectionsByName = useMemo(() => {
    const map = new Map<string, { name: string }>();
    for (const c of managedQuery.data?.connections ?? []) {
      map.set(c.name, c);
    }
    return map;
  }, [managedQuery.data?.connections]);

  const handleAskAgent = () => {
    onAskAgent({
      title: t("connections.askAgentTitle"),
      prompt: t("connections.askAgentPrompt"),
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("connections.addTitle", "Add connection")}</SheetTitle>
          <SheetDescription>
            {t(
              "connections.addDescription",
              "Connect a new service or MCP server. Use the catalog for known providers or add a custom server.",
            )}
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "catalog" | "custom" | "other")}
          className="mt-4"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="mt-4 space-y-3">
            {OAUTH_PROVIDERS.filter((e) => !e.hidden).map((entry) => {
              const conn = connectionsByName.get(entry.provider);
              const status = resolveConnectionStatus(conn);
              return (
                <OAuthConnectionCard
                  key={entry.provider}
                  entry={entry}
                  status={status}
                />
              );
            })}
            <p className="text-xs text-muted-foreground px-1">
              Direct OAuth start is built into the cards above.
            </p>
          </TabsContent>

          <TabsContent value="custom" className="mt-4 space-y-4">
            <CustomMcpForm
              onSubmit={async (req) => {
                try {
                  const res = await addLocalMcp(req);
                  // For now the backend just acknowledges; UI can show toast or
                  // immediately fall back to agent if persistence is still missing.
                  console.info("add_local_mcp result", res);
                  onOpenChange(false);
                  // TODO: invalidate inventory + connections queries on success
                } catch (e) {
                  console.error("add_local_mcp failed", e);
                }
              }}
              onAskAgent={handleAskAgent}
            />
          </TabsContent>

          <TabsContent value="other" className="mt-4 space-y-3">
            <div className="rounded-md border p-4 text-sm">
              Paste a JSON config or use the agent for anything not in the
              catalog.
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleAskAgent}
            >
              <IconRobot className="size-4" /> Paste JSON / Ask agent
            </Button>
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            className="sm:mr-auto"
            onClick={handleAskAgent}
          >
            <IconRobot className="size-4" />
            {t("connections.useAgentFallback", "Use agent instead")}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// --- Custom MCP form (reuses extension form primitives) ---

function CustomMcpForm({
  onSubmit,
  onAskAgent,
}: {
  onSubmit: (req: AddLocalMcpRequest) => Promise<void>;
  onAskAgent: () => void;
}) {
  const form = useExtensionModalForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const payload: AddLocalMcpRequest = {
        name: form.name,
        type: form.type as "stdio" | "streamable_http",
        description: form.description || undefined,
        cmd: form.cmd || undefined,
        args: form.args
          ? form.args.split("\n").filter(Boolean)
          : undefined,
        uri: form.uri || undefined,
        envs: form.envVars.reduce((acc, v) => {
          if (v.key) acc[v.key] = v.value;
          return acc;
        }, {} as Record<string, string>),
        timeout: parseInt(form.timeout, 10) || undefined,
      };
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="mcp-name">Name</Label>
        <Input
          id="mcp-name"
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          placeholder="my-mcp-server"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mcp-type">Type</Label>
        <Select
          value={form.type}
          onValueChange={(v) => form.setType(v as ExtensionModalType)}
        >
          <SelectTrigger id="mcp-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stdio">stdio</SelectItem>
            <SelectItem value="streamable_http">streamable-http</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.type === "stdio" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-cmd">Command</Label>
            <Input
              id="mcp-cmd"
              value={form.cmd}
              onChange={(e) => form.setCmd(e.target.value)}
              placeholder="npx"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-args">Arguments (one per line)</Label>
            <Textarea
              id="mcp-args"
              value={form.args}
              onChange={(e) => form.setArgs(e.target.value)}
              placeholder={"--token\nsecret-argument"}
              rows={3}
            />
          </div>
        </>
      )}

      {form.type === "streamable_http" && (
        <div className="space-y-1.5">
          <Label htmlFor="mcp-uri">URI</Label>
          <Input
            id="mcp-uri"
            value={form.uri}
            onChange={(e) => form.setUri(e.target.value)}
            placeholder="https://example.com/mcp"
          />
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleSubmit}
          disabled={!form.canSubmit || submitting}
          className="flex-1"
        >
          <IconPlus className="size-4" /> Add
        </Button>
        <Button variant="outline" onClick={onAskAgent}>
          <IconRobot className="size-4" /> Ask agent
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Direct persistence is a stub. This will route to the agent fallback until
        the real write path lands.
      </p>
    </div>
  );
}
