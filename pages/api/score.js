// pages/api/score.js
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";

export const config = {
  api: {
    bodyParser: { sizeLimit: "15mb" },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Only POST allowed");
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // decode data-url
    const m = image.match(/^data:(.+);base64,(.+)$/);
    if (!m) {
      return res.status(400).json({ error: "Invalid data URL" });
    }
    const buffer = Buffer.from(m[2], "base64");

    // write tmp file
    const tmp = os.tmpdir();
    const fname = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const filePath = path.join(tmp, fname);
    await fs.writeFile(filePath, buffer);

    // point at your script + model
    const script = path.join(process.cwd(), "eval_saved.py");
    const model = path.join(process.cwd(), "new_saved_resnet50.pt");

    // decide which python
    let pyExec = "python3";
    // if python3 not in PATH, fall back to python
    // (we'll detect the failure and then retry)
    let tried = false;
    let lastErr = "";

    async function runWith(execName) {
      return new Promise((resolve) => {
        const proc = spawn(execName, [script, filePath, model], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        let out = "";
        let err = "";
        proc.stdout.on("data", (d) => (out += d.toString()));
        proc.stderr.on("data", (d) => (err += d.toString()));
        proc.on("close", (code) => resolve({ code, out, err }));
      });
    }

    // try python3, then python
    let result = await runWith(pyExec);
    if (result.code !== 0) {
      // retry once with "python"
      tried = true;
      result = await runWith("python");
      pyExec = "python";
    }

    // cleanup
    await fs.unlink(filePath).catch(() => {});

    if (result.code !== 0) {
      console.error("❌ PYTHON FAILED:");
      console.error(" → exec:", pyExec);
      console.error(" → stdout:", result.out);
      console.error(" → stderr:", result.err);
      return res.status(500).json({
        error: "Inference failed",
        debug: {
          exec: pyExec,
          stdout: result.out,
          stderr: result.err,
        },
      });
    }

    // parse float
    const score = parseFloat(result.out);
    if (Number.isNaN(score)) {
      return res.status(500).json({ error: "Bad float from Python", debug: result.out });
    }

    res.status(200).json({ score });
  } catch (ex) {
    console.error("❌ HANDLER ERROR:", ex);
    res.status(500).json({ error: ex.message });
  }
}
