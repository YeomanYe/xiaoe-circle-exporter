import { access, copyFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(sourceDir, "../..");
const backupDir = path.join(
  root,
  ".agent/promote-handoff/xiaoe-store-assets-20260816/backup",
);

const chromeExecutable = await findChromeExecutable();

const renderTasks = [
  {
    source: "small-promo-440x280.html",
    width: 440,
    height: 280,
    outputs: [
      "store-assets/chrome/small-promo-440x280.png",
      "store-assets/edge/small-promo-440x280.png",
    ],
  },
  {
    source: "large-promo-1400x560.html",
    width: 1400,
    height: 560,
    outputs: [
      "store-assets/chrome/marquee-promo-1400x560.png",
      "store-assets/edge/large-promo-1400x560.png",
    ],
  },
  {
    source: "screenshot-1280x800.html",
    width: 1280,
    height: 800,
    outputs: ["store-assets/common/screenshot-1280x800.png"],
  },
  {
    source: "screenshot-edge-1280x800.html",
    width: 1280,
    height: 800,
    outputs: ["store-assets/edge/screenshot-1280x800.png"],
  },
  {
    source: "logo-300x300.html",
    width: 300,
    height: 300,
    outputs: ["store-assets/edge/logo-300x300.png"],
  },
];

const copyTasks = [
  {
    source: "static/icons/icon-enabled-128.png",
    outputs: [
      "store-assets/chrome/icon-128x128.png",
      "store-assets/edge/icon-128x128.png",
    ],
  },
];

const browser = await chromium.launch({
  executablePath: chromeExecutable,
  headless: true,
});

try {
  for (const task of renderTasks) {
    const page = await browser.newPage({
      viewport: { width: task.width, height: task.height },
      deviceScaleFactor: 1,
    });
    await page.goto(pathToFileURL(path.join(sourceDir, task.source)).href);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts?.ready);

    const [primaryOutput, ...duplicateOutputs] = task.outputs;
    const primaryPath = path.join(root, primaryOutput);
    await backupIfPresent(primaryPath, primaryOutput);
    await mkdir(path.dirname(primaryPath), { recursive: true });
    await page.screenshot({ path: primaryPath, type: "png" });
    await page.close();

    for (const duplicateOutput of duplicateOutputs) {
      const duplicatePath = path.join(root, duplicateOutput);
      await backupIfPresent(duplicatePath, duplicateOutput);
      await mkdir(path.dirname(duplicatePath), { recursive: true });
      await copyFile(primaryPath, duplicatePath);
    }

    console.log(`${task.width}x${task.height} -> ${task.outputs.join(", ")}`);
  }
} finally {
  await browser.close();
}

for (const task of copyTasks) {
  const sourcePath = path.join(root, task.source);
  for (const output of task.outputs) {
    const outputPath = path.join(root, output);
    await backupIfPresent(outputPath, output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await copyFile(sourcePath, outputPath);
    console.log(`copy ${task.source} -> ${output}`);
  }
}

async function backupIfPresent(filePath, relativePath) {
  try {
    await access(filePath);
  } catch {
    return;
  }
  const backupPath = path.join(backupDir, relativePath);
  try {
    await access(backupPath);
  } catch {
    await mkdir(path.dirname(backupPath), { recursive: true });
    await copyFile(filePath, backupPath);
  }
}

async function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_EXECUTABLE,
    path.join(
      os.homedir(),
      "Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    ),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known local browser path.
    }
  }

  throw new Error(
    "No Chromium executable found. Set CHROME_EXECUTABLE to a local Chrome/Chromium binary.",
  );
}
