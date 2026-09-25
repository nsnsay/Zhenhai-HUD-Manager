/**
 * 数据库三个表格共用的外观。
 *
 * 内容层统一用实色表面 + 分隔线，不再叠半透明模糊（HIG `liquid-glass.md`：
 * 模糊属于浮层，不该铺进内容区）；表头字号 13.5px，不低于桌面 10pt（≈13.3px）下限。
 */
export const DATABASE_TABLE_UI = {
  wrapper: "min-h-0",
  base: "min-w-full",
  thead: "bg-elevated",
  th: "px-4 py-2.5 text-[13.5px] font-medium text-toned border-b border-default",
  td: "px-4 py-3 text-sm border-b border-default last:border-b-0",
  tr: "transition-colors hover:bg-accented/40 focus-within:bg-accented/40",
  separator: "z-0 opacity-0",
};
