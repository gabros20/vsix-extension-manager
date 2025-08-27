#!/usr/bin/env node

import { Command } from "commander";
import { downloadVsix } from "./commands/download";
import packageJson from "../package.json";

const program = new Command();

program
	.name("vsix-downloader")
	.description("Download VS Code extensions as VSIX files from the Visual Studio Marketplace")
	.version(packageJson.version);

program
	.command("download")
	.alias("dl")
	.description("Download a VSIX file from marketplace URL")
	.option("-u, --url <url>", "Marketplace URL of the extension")
	.option("-v, --version <version>", "Version of the extension to download")
	.option("-o, --output <path>", "Output directory (default: ./downloads)")
	.action(downloadVsix);

// Default command - interactive mode
program.action(() => {
	downloadVsix({});
});

program.parse();
