<script setup lang="ts">
const localResources = [
  {
    label: "GSI Endpoint",
    value: "http://127.0.0.1:1469/gsi",
    icon: "i-lucide-webhook",
    description: "CS2 posts Game State Integration payloads here.",
  },
  {
    label: "Overlay",
    value: "http://127.0.0.1:1469/overlay/",
    icon: "i-lucide-presentation",
    description: "Hosted HUD page used by the transparent overlay window.",
  },
  {
    label: "REST API",
    value: "http://127.0.0.1:1469/api",
    icon: "i-lucide-server",
    description: "Read database collections from local HTTP clients.",
  },
  {
    label: "Assets",
    value: "http://127.0.0.1:1469/assets",
    icon: "i-lucide-image",
    description: "User uploaded logos and avatars are served from here.",
  },
] as const;

const usefulLinks = [
  {
    label: "CS2 Game State Integration",
    href: "https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration",
    description: "Official documentation for CS2 / CS:GO GSI payloads.",
    icon: "i-lucide-book-open",
  },
  {
    label: "ZhenHai HUD Manager",
    href: "https://github.com/nsnsay/Zhenhai-HUD-Manager",
    description: "Get more informations from Github Project Repository.",
    icon: "i-lucide-github",
  },
  {
    label: "Steam Developer Wiki",
    href: "https://developer.valvesoftware.com/wiki/Steam",
    description: "Valve developer resources and platform documentation.",
    icon: "i-lucide-terminal-square",
  },
] as const;
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-5">
    <div>
      <h2 class="text-lg font-semibold leading-6">Commands & Links</h2>
      <p class="mt-1 text-sm text-muted">
        Local endpoints and useful references for ZhenHai development.
      </p>
    </div>

    <section class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-cable" class="h-4 w-4 text-primary" />
        <h3 class="text-sm font-semibold">Local endpoints</h3>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <UCard
          v-for="resource in localResources"
          :key="resource.label"
          :ui="{
            root: 'rounded-lg border border-default/40 bg-elevated/30 shadow-sm backdrop-blur-xl',
            body: 'sm:p-3',
          }"
        >
          <div class="flex items-start gap-3">
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated/70 text-primary"
            >
              <UIcon :name="resource.icon" class="h-4 w-4" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold">{{ resource.label }}</div>
              <div class="mt-1 font-mono text-xs text-muted">{{ resource.value }}</div>
              <p class="mt-2 text-xs leading-5 text-dimmed">{{ resource.description }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-link" class="h-4 w-4 text-primary" />
        <h3 class="text-sm font-semibold">Useful links</h3>
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <UCard
          v-for="link in usefulLinks"
          :key="link.label"
          :ui="{
            root: 'rounded-lg border border-default/40 bg-elevated/30 shadow-sm backdrop-blur-xl',
            body: 'p-4 sm:p-5',
          }"
        >
          <div class="flex h-full flex-col">
            <UIcon :name="link.icon" class="h-5 w-5 text-primary" />
            <div class="mt-3 text-sm font-semibold">{{ link.label }}</div>
            <p class="mt-2 flex-1 text-xs leading-5 text-muted">{{ link.description }}</p>
            <UButton
              label="Open"
              icon="i-lucide-external-link"
              color="neutral"
              variant="ghost"
              size="sm"
              class="mt-3 justify-start"
              :to="link.href"
              target="_blank"
            />
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss"></style>
