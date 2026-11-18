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
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="px-6 pt-6 pr-12 pb-4">
          <SheetTitle>{t("connections.addTitle", "Add connection")}</SheetTitle>
          <SheetDescription>
            {t(
              "connections.addDescription",
              "Connect a new service or MCP server. Use the catalog for known providers or add a custom server.",
            )}
          </SheetDescription>
        </SheetHeader>

        <div aria-hidden="true" className="mx-6 h-px bg-border/70" />

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "catalog" | "custom" | "other")}
          className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6"
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

          <TabsContent value="custom" className="mt-4">
            <div className="rounded-lg border bg-card p-4">
              <CustomMcpForm
                onSubmit={async (req) => {
                  try {
                    const res = await addLocalMcp(req);
                    console.info("add_local_mcp result", res);
                    onOpenChange(false);
                  } catch (e) {
                    console.error("add_local_mcp failed", e);
                  }
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="other" className="mt-4">
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Paste MCP config (JSON)</Label>
                <Textarea
                  placeholder={`{\n  "mcpServers": {\n    "my-server": {\n      "command": "npx",\n      "args": ["--some-flag"]\n    }\n  }\n}`}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
              <Button variant="primary" className="w-full" disabled>
                Add from JSON
              </Button>
              <p className="text-[10px] text-muted-foreground">
                JSON paste is a stub. Will parse and add once the write path is
                implemented.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div aria-hidden="true" className="mx-6 h-px bg-border/70" />

        <SheetFooter className="mt-0 flex-row items-center px-6 py-4">
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
}: {
  onSubmit: (req: AddLocalMcpRequest) => Promise<void>;
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

      <Button
        onClick={handleSubmit}
        disabled={!form.canSubmit || submitting}
        className="w-full"
      >
        <IconPlus className="size-4" /> Add
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Direct persistence is a stub. This will route to the agent fallback until
        the real write path lands.
      </p>
    </div>
  );
}
