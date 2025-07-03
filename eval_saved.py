# eval_saved.py
import sys
try:
    import torch
    from PIL import Image
    from torchvision import transforms

    img_path = sys.argv[1]
    model_path = sys.argv[2]

    m = torch.jit.load(model_path)
    m.eval()

    tf = transforms.Compose([
        transforms.Resize(224),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485,0.456,0.406],
            std=[0.229,0.224,0.225]
        )
    ])
    img = Image.open(img_path).convert("RGB")
    x = tf(img).unsqueeze(0)

    with torch.no_grad():
        out = m(x)
        prob = torch.sigmoid(out).item()

    # Write only the float
    sys.stdout.write(f"{prob}")
    sys.exit(0)

except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
