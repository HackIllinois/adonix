import { readFile, writeFile } from "fs/promises";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import prompts from "prompts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUMP_DESCRIPTIONS = {
    patch: "A small backwards compatible bug fix",
    minor: "A backwards compatible feature",
    major: "A non-backwards compatible change",
};

async function bumpVersion() {
    // Read package.json
    const packagePath = resolve(__dirname, "..", "package.json");
    const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
    const currentVersion = packageJson.version;

    // Compute bumps
    const [major, minor, patch] = currentVersion.split(".").map(Number);
    const bumps = {
        patch: `${major}.${minor}.${patch + 1}`,
        minor: `${major}.${minor + 1}.0`,
        major: `${major + 1}.0.0`,
    };

    // Prompt for version bump type
    const { bumpType } = await prompts({
        type: "select",
        name: "bumpType",
        message: `Current version is ${currentVersion}. What type of bump?`,
        choices: Object.entries(bumps).map(([type, bump]) => ({
            title: `${type}: ${currentVersion} -> ${bump} - ${BUMP_DESCRIPTIONS[type]}`,
            value: type,
        })),
    });

    if (!bumpType) {
        console.log("Cancelled");
        process.exit(0);
    }

    // Update package.json and run git commands
    const newVersion = bumps[bumpType];
    console.log("Updating package.json...");
    packageJson.version = newVersion;
    await writeFile(packagePath, JSON.stringify(packageJson, null, 4) + "\n");

    execSync("yarn", { stdio: "inherit" });

    console.log("Creating git commit and tag...");
    execSync("git add package.json yarn.lock", { stdio: "inherit" });
    execSync(`git commit -m "Bump version to v${newVersion}"`, { stdio: "inherit" });
    execSync(`git tag -a v${newVersion} -m "v${newVersion}"`, { stdio: "inherit" });

    console.log(`\nBumped version to v${newVersion}`);
    console.log("Make sure to do `git push && git push --tags`!");
}

bumpVersion();
