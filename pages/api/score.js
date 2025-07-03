// pages/api/score.js
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

export const config = {
  api: {
    bodyParser: { sizeLimit: '15mb' }, // allow up to 15MB images
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Only POST allowed');
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // decode the data URL
    const m = image.match(/^data:(.+);base64,(.+)$/);
    if (!m) {
      return res.status(400).json({ error: 'Invalid data URL' });
    }
    const buffer = Buffer.from(m[2], 'base64');

    // write it out to a temp file
    const tmp = os.tmpdir();
    const fname = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const filePath = path.join(tmp, fname);
    await fs.writeFile(filePath, buffer);

    // point at your python script + model (both located under pages/api/)
    const script = path.join(process.cwd(), 'pages', 'api', 'eval_saved.py');
    const model  = path.join(process.cwd(), 'pages', 'api', 'new_saved_resnet50.pt');

    // helper to spawn Python
    const run = (cmd) => new Promise((resolve) => {
      const p = spawn(cmd, [script, filePath, model], { stdio: ['ignore','pipe','pipe'] });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => resolve({ code, out, err }));
    });

    // try python3, fall back to python
    let result = await run('python3');
    if (result.code !== 0) {
      result = await run('python');
    }

    // clean up
    await fs.unlink(filePath).catch(() => {});

    if (result.code !== 0) {
      console.error('PYTHON ERROR:', result.err);
      return res.status(500).json({ error: 'Inference failed', debug: result.err });
    }

    const score = parseFloat(result.out);
    if (Number.isNaN(score)) {
      return res.status(500).json({ error: 'Bad float from Python', debug: result.out });
    }

    return res.status(200).json({ score });
  } catch (ex) {
    console.error('HANDLER ERROR:', ex);
    return res.status(500).json({ error: ex.message });
  }
}
