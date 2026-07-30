import fs from "fs";
import path from "path";

const src = "C:\\Users\\conne\\.gemini\\antigravity\\brain\\ca0e2dd8-ef89-449f-95bd-609305d74238\\davelabs_horizon_banner_1785356974013.png";
const dest = "C:\\Projects\\optiq\\public\\media\\davelabs_horizon_banner.png";

if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log(`[SUCCESS] Banner copied to ${dest}`);
} else {
  console.error(`[ERROR] Source banner not found at ${src}`);
}
