#!/usr/bin/env node
/**
 * README / docs 文档校验（无第三方依赖）。
 *
 * 校验项：
 * 1. README.md、README_ZH.md 与 docs 下所有 markdown 的相对链接目标存在；
 * 2. docs/zh-CN 与 docs/en-US 文件集合一致，且对应文档的标题层级序列一致；
 * 3. README.md 与 README_ZH.md 的标题层级序列一致（中英结构镜像）；
 * 4. 文档中不残留 TODO / TBD / FIXME 占位符。
 *
 * 行内代码块（``` 与 ~~~ 围栏）不参与标题、链接与占位符识别。
 *
 * 用法：bun run docs:check
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(rootDir, "docs");
const languageDirs = ["zh-CN", "en-US"];
const readmeFiles = ["README.md", "README_ZH.md"];

const fencePattern = /^\s{0,3}(`{3,}|~{3,})/;
const markdownLinkPattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const headingPattern = /^(#{1,6})[ \t]+\S/gm;
const placeholderPattern = /\b(TODO|TBD|FIXME)\b/g;
const externalLinkPattern = /^[a-z][a-z0-9+.-]*:/i;

/** @type {string[]} */
const problems = [];

function toPosixPath(filePath) {
  return relative(rootDir, filePath).split("\\").join("/");
}

/** 去掉围栏代码块，避免把示例里的 # 注释当成标题。 */
function stripFencedCode(content) {
  const lines = content.split(/\r?\n/);
  const kept = [];
  let fenceMarker = null;

  for (const line of lines) {
    const match = line.match(fencePattern);

    if (match) {
      const marker = match[1] ?? "";

      if (fenceMarker === null) {
        fenceMarker = marker;
        kept.push("");
        continue;
      }

      if (marker[0] === fenceMarker[0] && marker.length >= fenceMarker.length) {
        fenceMarker = null;
        kept.push("");
        continue;
      }
    }

    if (fenceMarker === null) {
      kept.push(line);
    }
  }

  return kept.join("\n");
}

function readDocument(filePath) {
  return stripFencedCode(readFileSync(filePath, "utf8"));
}

/** 递归列出目录下的 markdown 文件。 */
function listMarkdownFiles(dir) {
  const files = [];

  for (const name of readdirSync(dir)) {
    const filePath = join(dir, name);

    if (statSync(filePath).isDirectory()) {
      files.push(...listMarkdownFiles(filePath));
      continue;
    }

    if (name.endsWith(".md")) {
      files.push(filePath);
    }
  }

  return files;
}

function exists(target) {
  try {
    statSync(target);
    return true;
  } catch {
    return false;
  }
}

/** 提取标题层级序列，例如 ["h1", "h2", "h3"]。 */
function headingLevels(content) {
  const levels = [];

  for (const match of content.matchAll(headingPattern)) {
    levels.push(`h${match[1].length}`);
  }

  return levels;
}

function checkLinks(filePath, content) {
  const fileDir = dirname(filePath);

  for (const match of content.matchAll(markdownLinkPattern)) {
    const rawTarget = (match[1] ?? "").trim();

    if (!rawTarget || rawTarget.startsWith("#") || externalLinkPattern.test(rawTarget)) {
      continue;
    }

    const pathPart = rawTarget.split("#")[0]?.split("?")[0] ?? "";

    if (!pathPart) {
      continue;
    }

    if (!exists(resolve(fileDir, decodeURIComponent(pathPart)))) {
      problems.push(`${toPosixPath(filePath)}: 链接目标不存在 -> ${rawTarget}`);
    }
  }
}

function checkPlaceholders(filePath, content) {
  for (const match of content.matchAll(placeholderPattern)) {
    problems.push(`${toPosixPath(filePath)}: 残留占位符 ${match[0]}`);
  }
}

function checkStructureParity(entries) {
  const structures = entries.map((entry) => headingLevels(entry.content).join(","));

  if (new Set(structures).size <= 1) {
    return;
  }

  for (let index = 0; index < entries.length; index++) {
    problems.push(
      `${entries.map((entry) => entry.label).join(" 与 ")} 的标题结构不一致：` +
        `${entries[index].label} -> ${structures[index]}`,
    );
  }
}

function main() {
  const readmes = [];

  for (const name of readmeFiles) {
    const filePath = join(rootDir, name);

    if (!exists(filePath)) {
      problems.push(`缺少文件：${name}`);
      continue;
    }

    readmes.push({ label: name, path: filePath, content: readDocument(filePath) });
  }

  const languageFiles = new Map();

  for (const language of languageDirs) {
    const dir = join(docsDir, language);

    if (!exists(dir)) {
      problems.push(`缺少目录：docs/${language}`);
      languageFiles.set(language, new Map());
      continue;
    }

    const map = new Map();

    for (const filePath of listMarkdownFiles(dir)) {
      map.set(toPosixPath(filePath).split("/").pop(), filePath);
    }

    languageFiles.set(language, map);
  }

  const [first, second] = languageDirs;
  const firstFiles = languageFiles.get(first) ?? new Map();
  const secondFiles = languageFiles.get(second) ?? new Map();

  for (const name of firstFiles.keys()) {
    if (!secondFiles.has(name)) {
      problems.push(`docs/${second} 缺少对应文档：${name}`);
    }
  }

  for (const name of secondFiles.keys()) {
    if (!firstFiles.has(name)) {
      problems.push(`docs/${first} 缺少对应文档：${name}`);
    }
  }

  for (const name of [...firstFiles.keys()].filter((entry) => secondFiles.has(entry)).sort()) {
    checkStructureParity([
      { label: `docs/${first}/${name}`, content: readDocument(firstFiles.get(name)) },
      { label: `docs/${second}/${name}`, content: readDocument(secondFiles.get(name)) },
    ]);
  }

  const documents = [
    ...readmes,
    ...[...firstFiles.entries()].map(([name, filePath]) => ({
      label: `docs/${first}/${name}`,
      path: filePath,
      content: readDocument(filePath),
    })),
    ...[...secondFiles.entries()].map(([name, filePath]) => ({
      label: `docs/${second}/${name}`,
      path: filePath,
      content: readDocument(filePath),
    })),
  ];

  for (const document of documents) {
    checkLinks(document.path, document.content);
    checkPlaceholders(document.path, document.content);
  }

  checkStructureParity(readmes);

  if (problems.length > 0) {
    console.error(`[docs:check] 发现 ${problems.length} 个问题：`);

    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(
    `[docs:check] 通过：${readmes.length} 份 README、${documents.length - readmes.length} 篇文档、` +
      `${languageDirs.length} 种语言镜像一致。`,
  );
}

main();
