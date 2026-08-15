import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inflateSync } from "node:zlib";
import {
  ACTION_ICON_PATHS,
  getActionIconPathsForUrl,
  getActionTitleForUrl,
  isSupportedActionUrl,
} from "../src/background.js";

test("uses highlighted action icons on Xiaoe Circle pages", () => {
  const url = "https://quanzi.xiaoe-tech.com/community-demo/feed_detail?feeds_id=feed-1";

  assert.equal(isSupportedActionUrl(url), true);
  assert.deepEqual(getActionIconPathsForUrl(url), ACTION_ICON_PATHS.enabled);
  assert.equal(getActionTitleForUrl(url), "打包鹅圈子帖子");
});

test("uses muted action icons outside Xiaoe Circle pages", () => {
  for (const url of ["https://example.com/", "https://xiaoeknow.com/", "not a url", ""]) {
    assert.equal(isSupportedActionUrl(url), false);
    assert.deepEqual(getActionIconPathsForUrl(url), ACTION_ICON_PATHS.disabled);
    assert.equal(getActionTitleForUrl(url), "请先打开鹅圈子页面");
  }
});

test("declares highlighted extension management icons by default", async () => {
  const manifest = JSON.parse(await readFile("static/manifest.json", "utf8"));

  assert.deepEqual(manifest.icons, ACTION_ICON_PATHS.enabled);
  assert.deepEqual(manifest.action.default_icon, ACTION_ICON_PATHS.disabled);
});

test("declares the extension display name", async () => {
  const manifest = JSON.parse(await readFile("static/manifest.json", "utf8"));

  assert.equal(manifest.name, "小鹅通助手");
});

test("centers the goose glyph in the highlighted icon", async () => {
  const png = decodePng(await readFile("static/icons/icon-enabled-128.png"));
  const bounds = findGlyphBounds(png, ({ r, g, b, a }) => a > 0 && r > 245 && g > 245 && b > 245);

  assert.ok(bounds, "Expected to find the white goose glyph");
  assert.ok(Math.abs(bounds.centerX - 63.5) <= 1.5, `glyph center x ${bounds.centerX} should be near 63.5`);
  assert.ok(Math.abs(bounds.centerY - 63.5) <= 1.5, `glyph center y ${bounds.centerY} should be near 63.5`);
});

function findGlyphBounds({ width, height, pixels }, predicate) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (
        predicate({
          r: pixels[offset],
          g: pixels[offset + 1],
          b: pixels[offset + 2],
          a: pixels[offset + 3],
        })
      ) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function decodePng(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.toString("ascii", offset, offset + 4);
    offset += 4;
    const chunk = buffer.subarray(offset, offset + length);
    offset += length + 4;

    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
    } else if (type === "IDAT") {
      idat.push(chunk);
    }
  }

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let rawOffset = 0;
  let previousRow = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const row = Buffer.from(raw.subarray(rawOffset, rawOffset + stride));
    rawOffset += stride;

    for (let index = 0; index < stride; index += 1) {
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      const up = previousRow[index];
      const upLeft = index >= bytesPerPixel ? previousRow[index - bytesPerPixel] : 0;

      if (filter === 1) {
        row[index] = (row[index] + left) & 255;
      } else if (filter === 2) {
        row[index] = (row[index] + up) & 255;
      } else if (filter === 3) {
        row[index] = (row[index] + Math.floor((left + up) / 2)) & 255;
      } else if (filter === 4) {
        row[index] = (row[index] + paethPredictor(left, up, upLeft)) & 255;
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter ${filter}`);
      }
    }

    row.copy(pixels, y * stride);
    previousRow = row;
  }

  return { width, height, pixels };
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}
