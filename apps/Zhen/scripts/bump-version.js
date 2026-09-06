const fs = require("node:fs");
const path = require("node:path");

const packagePath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const match = String(pkg.version || "").match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);

if (!match) {
  console.error(`Cannot bump non-semver version: ${pkg.version}`);
  process.exit(1);
}

const major = Number(match[1]);
const minor = Number(match[2]);
const patch = Number(match[3]) + 1;
const suffix = match[4] ?? "";

pkg.version = `${major}.${minor}.${patch}${suffix}`;

fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Version bumped to ${pkg.version}`);
