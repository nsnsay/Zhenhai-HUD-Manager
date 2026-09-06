import { ElectronAPI } from "@electron-toolkit/preload";
import type { WindowAPI } from "../shared/ipc";

declare global {
  interface Window {
    electron: ElectronAPI;
    api: WindowAPI;
  }
}
