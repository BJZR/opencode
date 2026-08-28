import { Component, createMemo, createSignal, startTransition } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { Dialog } from "@opencode-ai/ui/v2/dialog-v2"
import { TabsV2 } from "@opencode-ai/ui/v2/tabs-v2"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { SettingsGeneralV2 } from "./general"
import { SettingsKeybinds } from "../settings-keybinds"
import { SettingsProvidersV2 } from "./providers"
import { SettingsModelsV2 } from "./models"
import "./settings-v2.css"
import { SettingsServersV2 } from "./servers"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLayout } from "@/context/layout"
import { useTabs } from "@/context/tabs"
import { useServerSync } from "@/context/server-sync"

export const DialogSettings: Component<{
  sessionID?: string
  defaultValue?: string
}> = (props) => {
  const language = useLanguage()
  const platform = usePlatform()
  const dialog = useDialog()
  const layout = useLayout()
  const tabs = useTabs()
  const serverSync = useServerSync()
  const mobile = createMediaQuery("(max-width: 767px)")
  const [tab, setTab] = createSignal(props.defaultValue ?? "general")
  const directory = createMemo(() => {
    const route = layout.route()
    if (route.type === "dir-new-sesssion") return route.dir
    if (route.type === "draft") {
      const draft = tabs.store.find((item) => item.type === "draft" && item.draftID === route.draftID)
      return draft?.type === "draft" ? draft.directory : undefined
    }
    if (route.type === "session") return serverSync().session.get(route.sessionId)?.directory
    return undefined
  })

  const showProviders = () => {
    void dialog.show(() => <DialogSettings sessionID={props.sessionID} defaultValue="providers" />)
  }

  return (
    <Dialog size="x-large" variant="settings" class="settings-v2-dialog">
      <TabsV2
        orientation="vertical"
        variant="settings"
        value={tab()}
        onChange={(value) => void startTransition(() => setTab(value))}
        class="settings-v2"
      >
        <TabsV2.List>
          <div class="settings-v2-nav">
            <TooltipV2 placement="right" value={language.t("common.close")} inactive={!mobile()}>
              <IconButtonV2
                type="button"
                variant="ghost-muted"
                size="large"
                class="settings-v2-nav-close"
                icon={<Icon name="close" />}
                aria-label={language.t("common.close")}
                onClick={() => dialog.close()}
              />
            </TooltipV2>
            <div class="settings-v2-nav-sections">
              <div class="settings-v2-nav-section">
                <TabsV2.SectionTitle>{language.t("settings.section.desktop")}</TabsV2.SectionTitle>
                <div class="settings-v2-nav-group">
                  <TooltipV2 placement="right" value={language.t("settings.tab.general")} inactive={!mobile()}>
                    <TabsV2.Trigger value="general" aria-label={language.t("settings.tab.general")}>
                      <Icon name="sliders" />
                      <span class="settings-v2-nav-label">{language.t("settings.tab.general")}</span>
                    </TabsV2.Trigger>
                  </TooltipV2>
                  <TooltipV2 placement="right" value={language.t("settings.tab.shortcuts")} inactive={!mobile()}>
                    <TabsV2.Trigger value="shortcuts" aria-label={language.t("settings.tab.shortcuts")}>
                      <Icon name="keyboard" />
                      <span class="settings-v2-nav-label">{language.t("settings.tab.shortcuts")}</span>
                    </TabsV2.Trigger>
                  </TooltipV2>
                </div>
              </div>
              <div class="settings-v2-nav-divider" aria-hidden="true" />
              <div class="settings-v2-nav-section">
                <TabsV2.SectionTitle>{language.t("settings.section.server")}</TabsV2.SectionTitle>
                <div class="settings-v2-nav-group">
                  <TooltipV2 placement="right" value={language.t("status.popover.tab.servers")} inactive={!mobile()}>
                    <TabsV2.Trigger value="servers" aria-label={language.t("status.popover.tab.servers")}>
                      <Icon name="server" />
                      <span class="settings-v2-nav-label">{language.t("status.popover.tab.servers")}</span>
                    </TabsV2.Trigger>
                  </TooltipV2>
                  <TooltipV2 placement="right" value={language.t("settings.providers.title")} inactive={!mobile()}>
                    <TabsV2.Trigger value="providers" aria-label={language.t("settings.providers.title")}>
                      <Icon name="providers" />
                      <span class="settings-v2-nav-label">{language.t("settings.providers.title")}</span>
                    </TabsV2.Trigger>
                  </TooltipV2>
                  <TooltipV2 placement="right" value={language.t("settings.models.title")} inactive={!mobile()}>
                    <TabsV2.Trigger value="models" aria-label={language.t("settings.models.title")}>
                      <Icon name="models" />
                      <span class="settings-v2-nav-label">{language.t("settings.models.title")}</span>
                    </TabsV2.Trigger>
                  </TooltipV2>
                </div>
              </div>
            </div>
            <div class="settings-v2-nav-footer">
              <span>{language.t("app.name.desktop")}</span>
              <span>v{platform.version}</span>
            </div>
          </div>
        </TabsV2.List>
        <TabsV2.Content value="general" class="settings-v2-panel">
          <SettingsGeneralV2 sessionID={props.sessionID} />
        </TabsV2.Content>
        <TabsV2.Content value="shortcuts" class="settings-v2-panel">
          <SettingsKeybinds v2 />
        </TabsV2.Content>
        <TabsV2.Content value="servers" class="settings-v2-panel">
          <SettingsServersV2 />
        </TabsV2.Content>
        <TabsV2.Content value="providers" class="settings-v2-panel">
          <SettingsProvidersV2 directory={directory} onBack={showProviders} />
        </TabsV2.Content>
        <TabsV2.Content value="models" class="settings-v2-panel">
          <SettingsModelsV2 />
        </TabsV2.Content>
      </TabsV2>
    </Dialog>
  )
}
