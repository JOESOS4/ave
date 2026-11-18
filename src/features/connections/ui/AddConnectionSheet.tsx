import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { IconRobot } from "@tabler/icons-react";
import {
  CONNECTIONS_QUERY_KEY,
  listConnections,
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
import { OAUTH_PROVIDERS } from "@/features/connections/catalog";
import { resolveConnectionStatus } from "@/features/connections/lib/connectionStatus";
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
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"catalog" | "custom" | "other">("catalog");

  const managedQuery = useQuery({
    queryKey: CONNECTIONS_QUERY_KEY,
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

          <TabsContent value="custom" className="mt-4">
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Streamable-HTTP and stdio MCP form will appear here (reuses
              existing extension primitives).
            </div>
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
