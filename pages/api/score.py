# in pages/api/score.py
import base64
import os
import sys
import json
from tempfile import NamedTemporaryFile
from eval_saved import run_inference     # you’d refactor your eval_saved.py accordingly

def handler(request, response):
    if request.method != "POST":
        return response.status(405).send("Only POST allowed")

    payload = request.json()
    data_url = payload.get("image") or ""
    try:
        header, b64 = data_url.split(",", 1)
        img_data = base64.b64decode(b64)
    except:
        return response.status(400).json({"error":"Invalid data URL"})

    # write to a temp file
    tmp = NamedTemporaryFile(suffix=".png", delete=False)
    tmp.write(img_data)
    tmp.flush()
    tmp.close()

    try:
        score = run_inference(tmp.name, os.path.join(os.getcwd(), "new_saved_resnet50.pt"))
    finally:
        os.unlink(tmp.name)

    return response.json({"score": float(score)})
