import { useState } from "react";
import { IconPlus, IconRobot } from "@tabler/icons-react";
import type { AddLocalMcpRequest } from "@/features/connections/api/connections";
import { Button } from "@/shared/ui/button";
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
import {
  useExtensionModalForm,
  type ExtensionModalType,
} from "@/features/extensions/hooks/useExtensionModalForm";

// --- Custom MCP form (reuses extension form primitives) ---

export function CustomMcpForm({
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
        args: form.args ? form.args.split("\n").filter(Boolean) : undefined,
        uri: form.uri || undefined,
        envs: form.envVars.reduce(
          (acc, v) => {
            if (v.key) acc[v.key] = v.value;
            return acc;
          },
          {} as Record<string, string>,
        ),
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
        Direct persistence is a stub. This will route to the agent fallback
        until the real write path lands.
      </p>
    </div>
  );
}

// --- JSON paste catch-all, for anything not in the catalog ---

export function OtherMcpPanel({ onAskAgent }: { onAskAgent: () => void }) {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
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
      <Button variant="outline" className="w-full" onClick={onAskAgent}>
        <IconRobot className="size-4" /> Use agent instead
      </Button>
    </div>
  );
}
