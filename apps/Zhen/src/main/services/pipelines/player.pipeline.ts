import type { DatabaseService } from "../database.service";
import type { GsiMiddleware } from "../gsi-pipeline.service";
import type { CSGO, Player, PlayerFormData } from "@zhenhai/csgogsi/types";
import { logger } from "../logger.service";

const ASSET_BASE = "http://127.0.0.1:1469/assets";

function getAssetUrl(relativePath: string): string {
  if (!relativePath) return "";
  if (relativePath.startsWith("http") || relativePath.startsWith("data:")) {
    return relativePath;
  }
  return `${ASSET_BASE}/${relativePath}`;
}

const PRIMARY_WEAPON_TYPES = new Set([
  "Rifle",
  "SniperRifle",
  "Submachine Gun",
  "Shotgun",
  "Machine Gun",
]);

interface DbPlayer extends PlayerFormData {
  id?: string;
}

function createPlayerEnricher(dbService: DatabaseService): GsiMiddleware {
  logger.debug("PlayerEnricher", "Middleware registered");

  return (data: CSGO) => {
    if (!data) return data;

    const players = data.players;
    const focusedPlayer = data.player;
    if (!players) {
      logger.debug("PlayerEnricher", "No players in data");
      return data;
    }

    const focusedSteamId = String(focusedPlayer?.steamid ?? "");

    const result = dbService.list("players");
    if (!result.success || !result.data) {
      logger.warn("PlayerEnricher", "DB query failed");
      return data;
    }

    const playerMap = new Map<string, DbPlayer>();
    for (const dbPlayer of result.data as unknown as DbPlayer[]) {
      const steamId = String(dbPlayer.playerSteamID ?? "").trim();
      if (steamId) {
        playerMap.set(steamId, dbPlayer);
      }
    }

    const enrichWeapons = (player: Player) => {
      const weapons = player.weapons;

      if (!Array.isArray(weapons)) {
        player.primaryweapon = undefined;
        player.secondaryweapon = undefined;
        player.knifeweapon = undefined;
        player.activeweapon = undefined;
        player.grenades = [];
        player.isBomb = false;
        return;
      }

      const primary = weapons.find((w) => PRIMARY_WEAPON_TYPES.has(w.type ?? ""));
      player.primaryweapon = primary ? { ...primary } : undefined;

      const secondary = weapons.find((w) => w.type === "Pistol");
      player.secondaryweapon = secondary ? { ...secondary } : undefined;

      const knife = weapons.find((w) => w.type === "Knife");
      player.knifeweapon = knife ? { ...knife } : undefined;

      const active = weapons.find((w) => w.state === "active" || w.state === "reloading");
      player.activeweapon = active ? { ...active } : undefined;

      player.grenades = weapons.filter((w) => w.type === "Grenade").map((w) => ({ ...w }));

      player.isBomb = weapons.some((w) => w.type === "C4");
    };

    const playerExtension = (player: Player) => {
      if (!player) return;

      const steamId = String(player.steamid ?? "").trim();
      player.isFocused = steamId !== "" && steamId === focusedSteamId;

      player.isDead = (player.state?.health ?? 1) === 0;

      player.isArmorHelmet = player.state?.helmet === true;

      player.isArmor = player.state?.helmet === false && (player.state?.armor ?? 0) > 0;

      enrichWeapons(player);
    };

    const enrich = (player: Player) => {
      const steamId = String(player.steamid ?? "").trim();
      if (!steamId) return;

      const dbPlayer = playerMap.get(steamId);
      if (dbPlayer) {
        player._db = {
          playerName: dbPlayer.playerName,
          playerRealName: dbPlayer.playerRealName,
          playerAvatar: getAssetUrl(dbPlayer.playerAvatar),
          playerCountry: dbPlayer.playerCountry,
          playerSteamID: String(dbPlayer.playerSteamID ?? ""),
          playerCameraURL: dbPlayer.playerCameraURL ?? "",
        };
      }
    };

    const adjustObserverSlot = (player: Player) => {
      const slot = player.observer_slot;
      if (slot === undefined || slot === null) return;

      if (slot === 10) {
        player.observer_slot = 0;
      } else if (slot >= 11) {
      } else {
        player.observer_slot = slot + 1;
      }
    };

    if (Array.isArray(players)) {
      players.sort((a, b) => (a.observer_slot ?? 0) - (b.observer_slot ?? 0));

      players.forEach((player) => {
        enrich(player);
        playerExtension(player);
        adjustObserverSlot(player);
      });
    } else if (typeof players === "object") {
      const entries = Object.entries(players as unknown as Record<string, Player>);
      entries.sort((a, b) => (a[1].observer_slot ?? 0) - (b[1].observer_slot ?? 0));

      const sortedPlayers: Record<string, Player> = {};
      for (const [key, player] of entries) {
        enrich(player);
        playerExtension(player);
        adjustObserverSlot(player);
        sortedPlayers[key] = player;
      }
      data.players = Object.values(sortedPlayers);
    }

    return data;
  };
}

export default createPlayerEnricher;
