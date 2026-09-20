import type enUS from "./en-US";

export type MessageSchema = typeof enUS;

declare module "vue-i18n" {
  export interface DefineLocaleMessage extends MessageSchema {}
}