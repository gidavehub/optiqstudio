import fs from "fs";
import { execSync } from "child_process";

const videoPath = "C:\\Users\\conne\\OneDrive\\Desktop\\Horizon '26\\Official material\\DaveLabs Horizon Summer '26.mp4";

console.log("[INSPECT] Video File Path:", videoPath);
if (fs.existsSync(videoPath)) {
  const stats = fs.statSync(videoPath);
  console.log(`[FILE DETAILS] Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`[CREATED] ${stats.birthtime.toISOString()}`);
  console.log(`[MODIFIED] ${stats.mtime.toISOString()}`);
} else {
  console.error("[ERROR] File does not exist!");
}
