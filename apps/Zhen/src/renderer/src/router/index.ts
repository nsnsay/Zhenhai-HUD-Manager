import { createRouter, createWebHashHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import DatabaseView from "../views/DatabaseView.vue";
import ToolboxView from "../views/ToolboxView.vue";
import DatabaseMatchView from "../views/DatabaseView/DatabaseMatchView.vue";
import DatabasePlayerView from "@renderer/views/DatabaseView/DatabasePlayerView.vue";
import DatabaseTeamView from "@renderer/views/DatabaseView/DatabaseTeamView.vue";
import GsiDataView from "@renderer/views/Toolbox/GsiDataView.vue";
import CommandsLinksView from "@renderer/views/Toolbox/CommandsLinksView.vue";
import LogsView from "@renderer/views/Toolbox/LogsView.vue";
import OverlaysView from "@renderer/views/OverlaysView.vue";
import { rendererLogger } from "@renderer/utils/logger";

declare module "vue-router" {
  interface RouteMeta {
    labelKey?: string;
    icon?: string;
    sidebarVisible?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "database",
    component: DatabaseView,
    meta: {
      labelKey: "nav.database",
      icon: "i-lucide-database",
      sidebarVisible: true,
      defaultOpen: true,
    },
    children: [
      {
        path: "matchs",
        name: "matchs",
        meta: { labelKey: "nav.matchs", icon: "i-lucide-trophy", sidebarVisible: true },
        component: DatabaseMatchView,
      },
      {
        path: "teams",
        name: "teams",
        meta: { labelKey: "nav.teams", icon: "i-lucide-users", sidebarVisible: true },
        component: DatabaseTeamView,
      },
      {
        path: "players",
        name: "players",
        meta: { labelKey: "nav.players", icon: "i-lucide-circle-user-round", sidebarVisible: true },
        component: DatabasePlayerView,
      },
    ],
  },
  {
    path: "/overlays",
    name: "overlays",
    component: OverlaysView,
    meta: {
      labelKey: "nav.overlays",
      icon: "i-lucide-layers",
      sidebarVisible: true,
    },
  },
  {
    path: "/toolbox",
    name: "toolbox",
    component: ToolboxView,
    redirect: "/toolbox/gsi",
    meta: {
      labelKey: "nav.toolbox",
      icon: "i-lucide-square-dot",
      sidebarVisible: true,
    },
    children: [
      {
        path: "gsi",
        name: "toolbox-gsi",
        component: GsiDataView,
        meta: {
          labelKey: "nav.gsi",
          icon: "i-lucide-binary",
        },
      },
      {
        path: "commands-links",
        name: "toolbox-commands-links",
        component: CommandsLinksView,
        meta: {
          labelKey: "nav.commandsLinks",
          icon: "i-lucide-link-2",
        },
      },
      {
        path: "logs",
        name: "toolbox-logs",
        component: LogsView,
        meta: {
          labelKey: "nav.logs",
          icon: "i-lucide-scroll-text",
        },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.afterEach((to) => {
  rendererLogger.info("Router", "Route changed", {
    name: to.name,
    path: to.path,
  });
});

export default router;
