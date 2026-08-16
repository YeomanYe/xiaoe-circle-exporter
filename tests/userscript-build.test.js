import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("builds an installable Tampermonkey userscript", async () => {
  await execFileAsync(process.execPath, ["scripts/build-userscript.mjs"]);
  const output = await readFile("dist/xiaoe-helper.user.js", "utf8");

  assert.match(output, /\/\/ ==UserScript==/);
  assert.match(output, /@name\s+小鹅通助手/);
  assert.match(output, /@version\s+0\.1\.1/);
  assert.match(output, /@license\s+MIT/);
  assert.match(output, /@match\s+https:\/\/quanzi\.xiaoe-tech\.com\/\*/);
  assert.match(output, /@grant\s+GM_xmlhttpRequest/);
  assert.match(output, /@connect\s+xiaoeknow\.com/);
  assert.match(output, /@connect\s+myqcloud\.com/);
  assert.match(output, /@require\s+https:\/\/cdn\.jsdelivr\.net\/npm\/fflate/);
  assert.doesNotMatch(output, /require\("fflate"\)|Dynamic require/);

  const connectHosts = [...output.matchAll(/^\/\/ @connect\s+(.+)$/gm)].map((match) => match[1].trim());
  const resourceUrls = [
    "https://community-1252524126.cos.ap-shanghai.myqcloud.com/file/v2/1252524126/community/1786691984233-22848441.pdf",
    "https://wxresource-1252524126.cos.ap-shanghai.myqcloud.com/app0tGi74K25140/b3e4e5d5c069af6817c1dd2ecbddb96e.jpg",
    "https://quanzi-1252524126.cdn.xiaoeknow.com/app0tGi74K25140/image/u_61e034ff44aa4_6RYfN5Ggiy/vdn8srmsifyxn0.png",
  ];
  for (const url of resourceUrls) {
    assert.equal(isConnectAllowed(connectHosts, url), true, `${url} should be covered by @connect`);
  }
});

function isConnectAllowed(connectHosts, url) {
  const { hostname } = new URL(url);
  return connectHosts.some((host) => host === "*" || hostname === host || hostname.endsWith(`.${host}`));
}
