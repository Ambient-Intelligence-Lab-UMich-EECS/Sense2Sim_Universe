# Sense2Sim: offline package

在线版 / Online: https://ambient-intelligence-lab-umich-eecs.github.io/Sense2Sim_Universe/

- Sense2Sim Universe: the Sensing Universe and the Sensing World, shared by every Sense2Sim paper page
- Sensing Universe: the SenseWeaver knowledge base, 1,401 papers and 42 considered (updated 2026-11-17); the Model rating filter starts with A and B
- Sensing World: its spaces as of 2026-11-17, built from SenseWeaver top-down b1de8279 (unified/all/spaces/sim)
- 3D models from the SenseWeaver asset pack (pack of 2026-11-12); credits and licences in CREDITS.md
- The first page: a scroll-driven way into the Sensing Universe and the Sensing World (senseweaver-models tools/landing, 9836c12)
- Packed 2026-11-17 by tools/offline.mjs (SenseWeaver claude/project-thread-pvay98, 52d85c0); the Sensing World packed again the same day (cc67d89)

## 打开方式

1. 解压后双击 `index.html`。推荐用 Chrome 或 Edge；不需要网络。
2. 页面链接到的页面（`pages/` 里：“SenseWeaver Knowledge Base Review”, “Sensing World”）都在包里。

仍需联网的只有这些链接（点开时才需要）：没有

## How to open

1. Unzip, then double-click `index.html`. Chrome or Edge recommended; no network needed.
2. The pages it links to (under `pages/`: “SenseWeaver Knowledge Base Review”, “Sensing World”) are in the package.

Only these links still need the network (when clicked): none

## What is in it

- `index.html`: the page, as built, with its loads pointed at the package (offline.json lists every line rewritten)
- `pages/universe/`: a copy of the page “SenseWeaver Knowledge Base Review”
- `pages/world/`: a copy of the page “Sensing World”
- `CREDITS.md`
- 83 font files from Google Fonts, inlined

Made by tools/offline.mjs (SenseWeaver, skill senseweaver6); `offline.json` gives each file's bytes and sha256 and where each came from.
