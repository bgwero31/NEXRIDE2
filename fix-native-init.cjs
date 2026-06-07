const fs = require("fs");

const p = "src/app/layout.jsx";
let t = fs.readFileSync(p, "utf8");

const imp = 'import NexrideNativeInit from "@/components/system/NexrideNativeInit";';

if (t.includes("NexrideNativeInit from") === false) {
  const lines = t.split(/\r?\n/);
  let insertAt = 0;

  lines.forEach((line, i) => {
    if (line.trim().startsWith("import ")) insertAt = i + 1;
  });

  lines.splice(insertAt, 0, imp);
  t = lines.join("\n");
}

if (t.includes("<NexrideNativeInit />") === false) {
  t = t.replace(/<body[^>]*>/, (m) => m + "\n        <NexrideNativeInit />");
}

fs.writeFileSync(p, t);
console.log("NexrideNativeInit connected to layout.jsx");
