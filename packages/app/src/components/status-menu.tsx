import { createMemo, For, onCleanup, Show } from "solid-js"
import { useNavigate, useParams, useSearchParams } from "@solidjs/router"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { ServerHealthIndicator } from "@/components/server/server-row"
import { useGlobal } from "@/context/global"
import { useLanguage } from "@/context/language"
import { useMcpToggle } from "@/context/mcp"
import { usePlatform } from "@/context/platform"
import { SDKProvider } from "@/context/sdk"
import { ServerConnection, serverName, useServer } from "@/context/server"
import { ServerSDKProvider, useServerProtocol } from "@/context/server-sdk"
import { ServerSyncProvider } from "@/context/server-sync"
import { useSettings } from "@/context/settings"
import { useSync } from "@/context/sync"
import { type DraftTab, useTabs } from "@/context/tabs"
import { decode64 } from "@/utils/base64"
import { useSettingsDialog } from "./settings-dialog"
import { listServersByHealth, useDefaultServerKey } from "./status-popover-body"

export function StatusMenu(props: { size?: "small" | "normal" | "large"; placement?: "bottom-start" | "bottom-end" }) {
  const language = useLanguage()
  const openSettings = useSettingsDialog()
  const label = () => language.t("status.popover.trigger")

  return (
    <MenuV2 gutter={6} modal={false} placement={props.placement ?? "bottom-start"}>
      <TooltipV2 placement="bottom" value={label()}>
        <MenuV2.Trigger
          as={IconButtonV2}
          type="button"
          data-action="status-menu-toggle"
          variant="ghost-muted"
          size={props.size ?? "large"}
          class="shrink-0 [&_[data-slot=icon-svg]]:text-v2-icon-icon-muted"
          icon={<IconV2 name="settings-gear" />}
          aria-label={label()}
        />
      </TooltipV2>
      <MenuV2.Portal>
        <MenuV2.Content class="max-h-[min(480px,calc(100dvh-64px))] w-[300px] max-w-[calc(100vw-16px)] overflow-y-auto">
          <StatusMenuBody />
          <MenuV2.Separator />
          <MenuV2.Item onSelect={openSettings}>
            <IconV2 name="settings-gear" />
            <span class="min-w-0 flex-1 truncate">{language.t("sidebar.settings")}</span>
          </MenuV2.Item>
        </MenuV2.Content>
      </MenuV2.Portal>
    </MenuV2>
  )
}

// The menu lives at the router root, above the route-level directory providers,
// so it resolves the active server + directory itself and re-provides the
// server/directory-scoped contexts for the sections. Without an active
// directory (home) only the servers section is shown.
function StatusMenuBody() {
  const global = useGlobal()
  const server = useServer()
  const tabs = useTabs()
  const params = useParams<{ serverKey?: string; dir?: string; id?: string }>()
  const [search] = useSearchParams<{ draftId?: string }>()

  const activeDraft = createMemo(() => {
    const draftID = search.draftId
    if (!draftID) return
    return tabs.store.find((tab): tab is DraftTab => tab.type === "draft" && tab.draftID === draftID)
  })
  const conn = createMemo(() => {
    const key = decode64(params.serverKey) ?? activeDraft()?.server ?? server.key
    return global.servers.list().find((item) => ServerConnection.key(item) === key)
  })
  const directory = createMemo(() => {
    const dir = decode64(params.dir)
    if (dir) return dir
    const draft = activeDraft()
    if (draft) return draft.directory
    const id = params.id
    if (!id) return
    const current = conn()
    if (!current) return
    return global.ensureServerCtx(current).sync.session.lineage.peek(id)?.session.directory
  })

  return (
    <Show when={conn() && directory()} fallback={<ServerSection />}>
      <ServerSDKProvider server={conn}>
        <ServerSyncProvider server={conn}>
          <SDKProvider directory={() => directory()!}>
            <DirectorySections />
          </SDKProvider>
        </ServerSyncProvider>
      </ServerSDKProvider>
    </Show>
  )
}

function DirectorySections() {
  const protocol = useServerProtocol()
  return (
    <>
      <ServerSection />
      <McpSection />
      <LspSection />
      <Show when={protocol() === "v1"}>
        <PluginsSection />
      </Show>
    </>
  )
}

function ServerSection() {
  const global = useGlobal()
  const server = useServer()
  const platform = usePlatform()
  const dialog = useDialog()
  const language = useLanguage()
  const navigate = useNavigate()
  const settings = useSettings()
  let dialogRun = 0
  let dialogDead = false
  onCleanup(() => {
    dialogDead = true
    dialogRun += 1
  })

  const sortedServers = createMemo(() => {
    const list = settings.general.newLayoutDesigns()
      ? global.servers.list()
      : global.servers.list().filter((x) => global.ensureServerCtx(x).sdk.protocolKind() !== "v2")
    return listServersByHealth(list, server.key, global.servers.health)
  })
  const defaultServer = useDefaultServerKey(platform.getDefaultServer)

  return (
    <MenuV2.Group>
      <MenuV2.GroupLabel>{language.t("status.popover.tab.servers")}</MenuV2.GroupLabel>
      <For each={sortedServers()}>
        {(item) => {
          const key = ServerConnection.key(item)
          const blocked = () => global.servers.health[key]?.healthy === false
          return (
            <MenuV2.Item
              disabled={blocked()}
              badge={key === defaultServer.key() ? language.t("common.default") : undefined}
              trailing={
                <Show when={server.current && key === ServerConnection.key(server.current)}>
                  <IconV2 name="check" size="small" class="shrink-0 text-v2-icon-icon-muted" />
                </Show>
              }
              onSelect={() => {
                navigate("/")
                queueMicrotask(() => server.setActive(key))
              }}
            >
              <ServerHealthIndicator health={global.servers.health[key]} />
              <span class="min-w-0 flex-1 truncate">{serverName(item)}</span>
            </MenuV2.Item>
          )
        }}
      </For>
      <MenuV2.Item
        onSelect={() => {
          const run = ++dialogRun
          void import("./dialog-select-server").then((x) => {
            if (dialogDead || dialogRun !== run) return
            dialog.show(() => <x.DialogSelectServer />, defaultServer.refresh)
          })
        }}
      >
        <span class="min-w-0 flex-1 truncate">{language.t("status.popover.action.manageServers")}</span>
      </MenuV2.Item>
    </MenuV2.Group>
  )
}

const mcpDotClass = (status?: string) => {
  if (status === "connected") return "bg-icon-success-base"
  if (status === "failed") return "bg-icon-critical-base"
  if (status === "needs_auth" || status === "needs_client_registration") return "bg-icon-warning-base"
  return "bg-border-weak-base"
}

function McpSection() {
  const sync = useSync()
  const language = useLanguage()
  const toggleMcp = useMcpToggle()
  const names = createMemo(() => Object.keys(sync().data.mcp ?? {}).sort((a, b) => a.localeCompare(b)))

  return (
    <MenuV2.Group>
      <MenuV2.GroupLabel>{language.t("status.popover.tab.mcp")}</MenuV2.GroupLabel>
      <Show
        when={names().length > 0}
        fallback={<MenuV2.Item disabled>{language.t("dialog.mcp.empty")}</MenuV2.Item>}
      >
        <For each={names()}>
          {(name) => {
            const status = () => sync().data.mcp?.[name]?.status
            return (
              <MenuV2.Item
                closeOnClick={false}
                disabled={toggleMcp.isPending && toggleMcp.variables === name}
                onSelect={() => {
                  if (toggleMcp.isPending) return
                  toggleMcp.mutate(name)
                }}
              >
                <span class={`size-1.5 shrink-0 rounded-full ${mcpDotClass(status())}`} />
                <span class="min-w-0 flex-1 truncate">{name}</span>
                <Show when={status() === "needs_auth"}>
                  <span class="shrink-0 text-[11px] leading-none text-v2-text-text-faint">
                    {language.t("mcp.auth.clickToAuthenticate")}
                  </span>
                </Show>
              </MenuV2.Item>
            )
          }}
        </For>
      </Show>
    </MenuV2.Group>
  )
}

function LspSection() {
  const sync = useSync()
  const language = useLanguage()
  const items = createMemo(() => sync().data.lsp ?? [])

  return (
    <MenuV2.Group>
      <MenuV2.GroupLabel>{language.t("status.popover.tab.lsp")}</MenuV2.GroupLabel>
      <Show
        when={items().length > 0}
        fallback={<MenuV2.Item disabled>{language.t("dialog.lsp.empty")}</MenuV2.Item>}
      >
        <For each={items()}>
          {(item) => (
            <MenuV2.Item closeOnClick={false}>
              <span
                classList={{
                  "size-1.5 shrink-0 rounded-full": true,
                  "bg-icon-success-base": item.status === "connected",
                  "bg-icon-critical-base": item.status === "error",
                  "bg-border-weak-base": item.status !== "connected" && item.status !== "error",
                }}
              />
              <span class="min-w-0 flex-1 truncate">{item.name || item.id}</span>
            </MenuV2.Item>
          )}
        </For>
      </Show>
    </MenuV2.Group>
  )
}

function PluginsSection() {
  const sync = useSync()
  const language = useLanguage()
  const plugins = createMemo(() =>
    (sync().data.config.plugin ?? []).map((item) => (typeof item === "string" ? item : item[0])),
  )

  return (
    <MenuV2.Group>
      <MenuV2.GroupLabel>{language.t("status.popover.tab.plugins")}</MenuV2.GroupLabel>
      <Show
        when={plugins().length > 0}
        fallback={<MenuV2.Item disabled>{language.t("dialog.plugins.empty")}</MenuV2.Item>}
      >
        <For each={plugins()}>
          {(plugin) => (
            <MenuV2.Item closeOnClick={false}>
              <span class="size-1.5 shrink-0 rounded-full bg-icon-success-base" />
              <span class="min-w-0 flex-1 truncate">{plugin}</span>
            </MenuV2.Item>
          )}
        </For>
      </Show>
    </MenuV2.Group>
  )
}
