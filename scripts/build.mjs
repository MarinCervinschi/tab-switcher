// Bundles the extension into dist/, the folder Chrome loads unpacked.
// With --watch it rebuilds the scripts on every change; a change to static/ needs a restart.
import * as esbuild from "esbuild";
import { cp, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");

await rm("dist", { recursive: true, force: true });
await cp("static", "dist", { recursive: true });

const options = {
	entryPoints: ["src/background.ts", "src/content.ts"],
	bundle: true,
	format: "iife",
	target: "chrome121",
	outdir: "dist",
	logLevel: "info",
};

if (watch) {
	await (await esbuild.context(options)).watch();
} else {
	await esbuild.build(options);
}
