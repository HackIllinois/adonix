import * as esbuild from "esbuild";
import chokidar from "chokidar";
import http from "http";
import { join } from "path";
import { exec, execSync } from "child_process";

const build = () =>
    new Promise((resolve, reject) => {
        console.log("🤖 Building...");
        const childProcess = exec("yarn build", { stdio: "pipe" });

        childProcess.stdout?.pipe(process.stdout);
        childProcess.stderr?.pipe(process.stderr);

        childProcess.on("exit", (code) => {
            childProcess.kill();
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Failed to compile!`));
            }
        });
    });
let cleanup = null;
const serveBuild = async () => {
    console.log("🚀 Starting server...");
    const imported = await import("../out/app.js");
    const startServer = imported["startServer"];
    const server = await startServer();

    cleanup = () => {
        return new Promise((res) => {
            console.log("🛬 Closing server...");
            server.close((err) => {
                if (err) {
                    console.error("❌Error occurred closing server: ", err);
                }
                res();
            });
        });
    };
};

const buildAndServe = async () => {
    build()
        .then(() => {
            console.log("🤖 Build completed successfully!");
        })
        .catch((err) => {
            console.error("❌ Build failed:", err);
        })
        .then(serveBuild)
        .catch((err) => {
            console.error("❌ Serve failed:", err);
        });
};

await buildAndServe();

// Watch for changes in source files and rebuild
const watcher = chokidar.watch("./src/**");
watcher.on("change", async (path) => {
    console.log(`❓ File ${path} changed. Restarting...`);

    if (cleanup) {
        await cleanup();
    }

    buildAndServe();
});
