import { execSync } from "child_process";

try {
  console.log("[GIT] Adding files...");
  execSync("git add .", { cwd: "C:\\Projects\\optiq", stdio: "inherit" });

  console.log("[GIT] Committing...");
  execSync('git commit -m "Overhaul enterprise page with DaveLabs Horizon Summer \'26 banner, tiers, and contact channels"', {
    cwd: "C:\\Projects\\optiq",
    stdio: "inherit",
  });

  console.log("[GIT] Pushing to GitHub...");
  execSync("git push", { cwd: "C:\\Projects\\optiq", stdio: "inherit" });

  console.log("\n[SUCCESS] Code successfully pushed to GitHub repository!");
} catch (err) {
  console.error("[GIT ERROR]", err.message);
}
