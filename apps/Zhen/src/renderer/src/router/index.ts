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
import { rendererLogger } from "@renderer/utils/logger";

declare module "vue-router" {
  interface RouteMeta {
    label?: string;
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
      label: "Database",
      icon: "i-lucide-database",
      sidebarVisible: true,
      defaultOpen: true,
    },
    children: [
      {
        path: "matchs",
        name: "matchs",
        meta: { label: "Matchs", icon: "i-lucide-trophy", sidebarVisible: true },
        component: DatabaseMatchView,
      },
      {
        path: "teams",
        name: "teams",
        meta: { label: "Teams", icon: "i-lucide-users", sidebarVisible: true },
        component: DatabaseTeamView,
      },
      {
        path: "players",
        name: "players",
        meta: { label: "Players", icon: "i-lucide-circle-user-round", sidebarVisible: true },
        component: DatabasePlayerView,
      },
    ],
  },
  {
    path: "/toolbox",
    name: "toolbox",
    component: ToolboxView,
    redirect: "/toolbox/gsi",
    meta: {
      label: "Toolbox",
      icon: "i-lucide-square-dot",
      sidebarVisible: true,
    },
    children: [
      {
        path: "gsi",
        name: "toolbox-gsi",
        component: GsiDataView,
        meta: {
          label: "GSI Data",
          icon: "i-lucide-binary",
        },
      },
      {
        path: "commands-links",
        name: "toolbox-commands-links",
        component: CommandsLinksView,
        meta: {
          label: "Commands & Links",
          icon: "i-lucide-link-2",
        },
      },
      {
        path: "logs",
        name: "toolbox-logs",
        component: LogsView,
        meta: {
          label: "Logs",
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
