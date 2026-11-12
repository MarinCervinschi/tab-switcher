// Renders assets/icon.svg into the PNG sizes the manifest lists. Run it after editing
// the SVG; the PNGs are committed, so a build does not need it.
import { Resvg } from "@resvg/resvg-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const svg = await readFile("assets/icon.svg");
await mkdir("static/icons", { recursive: true });
for (const size of [16, 32, 48, 128]) {
	const png = new Resvg(svg, { fitTo: { mode: "width", value: size } })
		.render()
		.asPng();
	await writeFile(`static/icons/icon-${size}.png`, png);
}
