"""
Modal deployment for OmniLottie — serves the 4B parameter model on an A10G GPU.
Matches the official HuggingFace Space app.py exactly for prompt format and post-processing.
"""

import modal
import re

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "ffmpeg", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch==2.3.0",
        "torchvision==0.18.0",
        "transformers==4.51.3",
        "safetensors",
        "numpy>=1.24,<2.3",
        "Pillow",
        "decord==0.6.0",
        "opencv-python-headless",
        "qwen-vl-utils==0.0.11",
        "huggingface-hub",
        "accelerate",
        "fastapi[standard]",
        "python-multipart",
    )
    .run_commands(
        "git clone https://github.com/OpenVGLab/OmniLottie.git /opt/OmniLottie"
    )
    .run_commands(
        "huggingface-cli download OmniLottie/OmniLottie --local-dir /opt/omnilottie-weights"
    )
    .run_commands(
        "python -c \"from transformers import AutoProcessor; AutoProcessor.from_pretrained('Qwen/Qwen2.5-VL-3B-Instruct', padding_side='left')\""
    )
)

app = modal.App("omnilottie", image=image)

# --- Exact constants from app.py ---
SYSTEM_PROMPT = "You are a Lottie animation expert."
VIDEO_PROMPT = "Turn this video into Lottie code."
LOTTIE_BOS = 192398
LOTTIE_EOS = 192399
PAD_TOKEN = 151643


def simplify_to_animation_description(text):
    """Strip common prefixes — matches app.py exactly."""
    if not text or not isinstance(text, str):
        return text
    prefixes = [
        r'^The video features?\s+', r'^The scene shows?\s+',
        r'^An animation of\s+', r'^There is\s+', r'^It shows?\s+'
    ]
    for pattern in prefixes:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    if text:
        text = text[0].upper() + text[1:]
    return text.strip()


def build_messages(mode, text_prompt=None, image_path=None, video_path=None):
    """Build messages — matches app.py's build_messages exactly."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if mode == "text":
        text = simplify_to_animation_description(text_prompt)
        messages.append({
            "role": "user",
            "content": [{"type": "text", "text": f"Generate Lottie code: {text}"}]
        })
    elif mode == "image-text":
        text = simplify_to_animation_description(text_prompt)
        messages.append({
            "role": "user",
            "content": [
                {"type": "image", "image": f"file://{image_path}"},
                {"type": "text", "text": f"Animate this image: {text}"}
            ]
        })
    elif mode == "video":
        messages.append({
            "role": "user",
            "content": [
                {"type": "video", "video": f"file://{video_path}"},
                {"type": "text", "text": VIDEO_PROMPT}
            ]
        })

    return messages


def fix_lottie_json(anim):
    """Fix and validate Lottie JSON — matches app.py's fix_lottie_json exactly."""
    anim_ip = int(round(anim.get("ip", 0)))
    anim_op = int(round(anim.get("op", 16)))
    anim["ip"] = anim_ip
    anim["op"] = anim_op
    anim["fr"] = int(round(anim.get("fr", 8)))
    anim["ddd"] = int(anim.get("ddd", 0))

    # Round all keyframe 't' values recursively
    def fix_t_recursive(obj):
        if isinstance(obj, dict):
            if obj.get("a") == 1 and isinstance(obj.get("k"), list):
                for kf in obj["k"]:
                    if isinstance(kf, dict) and "t" in kf:
                        kf["t"] = int(round(kf["t"]))
            for v in obj.values():
                fix_t_recursive(v)
        elif isinstance(obj, list):
            for item in obj:
                fix_t_recursive(item)

    fix_t_recursive(anim)

    # Calculate canvas size from layer positions
    max_x = float(anim.get("w", 512))
    max_y = float(anim.get("h", 512))

    def collect_pos(layer):
        nonlocal max_x, max_y
        p = layer.get("ks", {}).get("p", {})
        if isinstance(p, dict):
            if p.get("a", 0) == 0:
                pv = p.get("k", [0, 0])
                if isinstance(pv, list) and len(pv) >= 2:
                    max_x = max(max_x, float(pv[0]))
                    max_y = max(max_y, float(pv[1]))
            else:
                for kf in p.get("k", []):
                    if isinstance(kf, dict):
                        for sv in (kf.get("s", []), kf.get("e", [])):
                            if isinstance(sv, list) and len(sv) >= 2:
                                max_x = max(max_x, float(sv[0]))
                                max_y = max(max_y, float(sv[1]))
        for sub in layer.get("layers", []):
            collect_pos(sub)

    for layer in anim.get("layers", []):
        collect_pos(layer)

    anim["w"] = max(512, int((max_x * 1.1 + 15) // 16 * 16))
    anim["h"] = max(512, int((max_y * 1.1 + 15) // 16 * 16))

    # Collect valid layer indices for parent validation
    valid_inds = set()
    for layer in anim.get("layers", []):
        if "ind" in layer:
            valid_inds.add(int(layer["ind"]))

    # Clean up shapes — add missing transforms
    def clean_shapes(shapes):
        if not isinstance(shapes, list):
            return shapes
        cleaned = []
        for sh in shapes:
            if not isinstance(sh, dict):
                continue
            if sh.get("ty") == "gr":
                sh["it"] = clean_shapes(sh.get("it", []))
                if not sh["it"]:
                    continue
                has_tr = any(
                    item.get("ty") == "tr"
                    for item in sh["it"]
                    if isinstance(item, dict)
                )
                if not has_tr:
                    sh["it"].append({
                        "ty": "tr", "nm": "",
                        "a": {"a": 0, "k": [0, 0], "ix": 1},
                        "p": {"a": 0, "k": [0, 0], "ix": 2},
                        "s": {"a": 0, "k": [100, 100], "ix": 3},
                        "r": {"a": 0, "k": 0, "ix": 6},
                        "o": {"a": 0, "k": 100, "ix": 7},
                        "sk": {"a": 0, "k": 0, "ix": 4},
                        "sa": {"a": 0, "k": 0, "ix": 5},
                        "hd": False
                    })
            cleaned.append(sh)
        return cleaned

    # Fix layer timing and clean up
    def fix_layer(layer):
        ip = int(round(layer.get("ip", anim_ip)))
        op = int(round(layer.get("op", anim_op)))
        layer["ip"] = max(anim_ip, ip)
        layer["op"] = min(anim_op, max(layer["ip"] + 1, op))
        layer["st"] = int(round(layer.get("st", anim_ip)))
        if "ind" in layer:
            layer["ind"] = int(layer["ind"])
        if "parent" in layer:
            p = int(layer["parent"])
            if p in valid_inds:
                layer["parent"] = p
            else:
                del layer["parent"]
        layer.pop("ct", None)
        if "shapes" in layer:
            layer["shapes"] = clean_shapes(layer["shapes"])
        for sub in layer.get("layers", []):
            fix_layer(sub)
        return layer

    fixed_layers = []
    for l in anim.get("layers", []):
        fix_layer(l)
        shapes = l.get("shapes", [])
        if l.get("ty") == 4 and not shapes:
            continue
        fixed_layers.append(l)
    anim["layers"] = fixed_layers

    for asset in anim.get("assets", []):
        if "layers" in asset:
            fixed = []
            for l in asset["layers"]:
                fix_layer(l)
                if l.get("ty") == 4 and not l.get("shapes"):
                    continue
                fixed.append(l)
            asset["layers"] = fixed

    return anim


@app.cls(
    gpu="A10G",
    timeout=600,
    scaledown_window=300,
)
class OmniLottieService:
    @modal.enter()
    def load_model(self):
        """Load model once when container starts."""
        import sys
        import torch

        sys.path.insert(0, "/opt/OmniLottie")

        from decoder import LottieDecoder
        from transformers import AutoProcessor

        self.device = "cuda"

        print("Loading processor from Qwen/Qwen2.5-VL-3B-Instruct...")
        self.processor = AutoProcessor.from_pretrained(
            "Qwen/Qwen2.5-VL-3B-Instruct", padding_side="left"
        )

        print("Initializing LottieDecoder...")
        self.model = LottieDecoder(pix_len=4560, text_len=1500)

        print("Loading model weights...")
        weights_path = "/opt/omnilottie-weights/pytorch_model.bin"
        self.model.load_state_dict(
            torch.load(weights_path, map_location="cpu")
        )
        self.model = self.model.to(self.device).eval()

        print("Model loaded successfully!")

    @modal.fastapi_endpoint(method="POST")
    def generate(self, request: dict):
        """Generate Lottie animation from multimodal input."""
        import sys
        import tempfile
        import base64
        import torch

        sys.path.insert(0, "/opt/OmniLottie")
        from qwen_vl_utils import process_vision_info

        mode = request.get("mode", "text")
        prompt = request.get("prompt", "")
        temperature = float(request.get("temperature", 0.9))
        top_p = float(request.get("top_p", 0.25))
        top_k = int(request.get("top_k", 5))
        max_tokens = int(request.get("max_tokens", 5556))
        use_sampling = request.get("use_sampling", True)

        try:
            # Write uploaded files to disk
            image_path = None
            video_path = None

            if mode == "image-text":
                image_b64 = request.get("image_base64", "")
                if not image_b64:
                    return {"error": "No image provided for image-text mode"}
                img_data = base64.b64decode(image_b64)
                # Detect format from magic bytes, default to png
                ext = ".png"
                if img_data[:3] == b'\xff\xd8\xff':
                    ext = ".jpg"
                elif img_data[:4] == b'RIFF' and img_data[8:12] == b'WEBP':
                    ext = ".webp"
                tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
                tmp.write(img_data)
                tmp.close()
                image_path = tmp.name

            elif mode == "video":
                video_b64 = request.get("video_base64", "")
                if not video_b64:
                    return {"error": "No video provided for video mode"}
                vid_data = base64.b64decode(video_b64)
                tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
                tmp.write(vid_data)
                tmp.close()
                video_path = tmp.name

            # Build messages — exact same format as app.py
            messages = build_messages(
                mode,
                text_prompt=prompt,
                image_path=image_path,
                video_path=video_path,
            )

            # Prepare input — matches app.py's prepare_inference_input
            text_input = self.processor.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
            image_inputs, video_inputs = process_vision_info(messages)

            inputs = self.processor(
                text=[text_input],
                images=image_inputs if image_inputs else None,
                videos=video_inputs if video_inputs else None,
                padding=False,
                return_tensors="pt",
            )

            input_ids = inputs["input_ids"]
            attention_mask = inputs["attention_mask"]

            # Pad to 1500 tokens (matching app.py)
            if input_ids.shape[1] < 1500:
                pad_len = 1500 - input_ids.shape[1]
                input_ids = torch.cat(
                    [
                        torch.full((1, pad_len), PAD_TOKEN, dtype=torch.long),
                        input_ids,
                    ],
                    dim=1,
                )
                attention_mask = torch.cat(
                    [
                        torch.zeros((1, pad_len), dtype=torch.long),
                        attention_mask,
                    ],
                    dim=1,
                )

            # Move to device
            prepared = {
                "input_ids": input_ids.to(self.device),
                "attention_mask": attention_mask.to(self.device),
                "pixel_values": inputs.get("pixel_values").to(self.device) if inputs.get("pixel_values") is not None else None,
                "image_grid_thw": inputs.get("image_grid_thw").to(self.device) if inputs.get("image_grid_thw") is not None else None,
                "pixel_values_videos": inputs.get("pixel_values_videos").to(self.device) if inputs.get("pixel_values_videos") is not None else None,
                "video_grid_thw": inputs.get("video_grid_thw").to(self.device) if inputs.get("video_grid_thw") is not None else None,
            }

            # Generate — matches app.py's generate_lottie
            self.model.transformer.rope_deltas = None
            position_ids, _ = self.model.transformer.get_rope_index(
                input_ids=prepared["input_ids"],
                attention_mask=prepared["attention_mask"],
                image_grid_thw=prepared.get("image_grid_thw"),
                video_grid_thw=prepared.get("video_grid_thw"),
            )
            position_ids = position_ids * prepared["attention_mask"][None,]

            kwargs = {
                "input_ids": prepared["input_ids"],
                "attention_mask": prepared["attention_mask"],
                "pixel_values": prepared.get("pixel_values"),
                "image_grid_thw": prepared.get("image_grid_thw"),
                "pixel_values_videos": prepared.get("pixel_values_videos"),
                "video_grid_thw": prepared.get("video_grid_thw"),
                "position_ids": position_ids,
                "max_new_tokens": max_tokens,
                "eos_token_id": LOTTIE_EOS,
                "pad_token_id": PAD_TOKEN,
                "use_cache": True,
            }

            if use_sampling:
                kwargs.update(
                    {
                        "do_sample": True,
                        "temperature": temperature,
                        "top_p": top_p,
                        "top_k": top_k,
                    }
                )
            else:
                kwargs.update({"do_sample": False, "num_beams": 1})

            with torch.no_grad():
                outputs = self.model.transformer.generate(**kwargs)

            input_len = prepared["input_ids"].shape[1]
            generated_ids = outputs[0][input_len:].tolist()

            del outputs, kwargs, position_ids
            torch.cuda.empty_cache()

            # Strip BOS/EOS tokens
            if generated_ids and generated_ids[0] == LOTTIE_BOS:
                generated_ids = generated_ids[1:]
            if LOTTIE_EOS in generated_ids:
                generated_ids = generated_ids[:generated_ids.index(LOTTIE_EOS)]

            # Convert to Lottie JSON
            lottie_json = self._tokens_to_lottie_json(generated_ids)

            return {
                "lottie_json": lottie_json,
                "tokens": len(generated_ids),
                "layers": len(lottie_json.get("layers", [])),
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            torch.cuda.empty_cache()
            return {"error": str(e)}

    def _tokens_to_lottie_json(self, generated_ids: list) -> dict:
        """Convert generated token IDs to Lottie JSON — mirrors app.py exactly."""
        import sys

        sys.path.insert(0, "/opt/OmniLottie")

        from lottie.objects.lottie_tokenize import LottieTensor
        from lottie.objects.lottie_param import (
            from_sequence,
            ShapeLayer,
            NullLayer,
            PreCompLayer,
            TextLayer,
            SolidColorLayer,
            Font,
            Chars,
            shape_layer_to_json,
            null_layer_to_json,
            precomp_layer_to_json,
            text_layer_to_json,
            solid_layer_to_json,
            font_to_json,
            char_to_json,
        )

        reconstructed_tensor = LottieTensor.from_list(generated_ids)
        reconstructed_sequence = reconstructed_tensor.to_sequence()
        reconstructed = from_sequence(reconstructed_sequence)

        json_animation = {
            "v": reconstructed.get("v", "5.5.2"),
            "fr": reconstructed.get("fr", 8),
            "ip": reconstructed.get("ip", 0),
            "op": reconstructed.get("op", 16),
            "w": reconstructed.get("w", 512),
            "h": reconstructed.get("h", 512),
            "nm": reconstructed.get("nm", "Animation"),
            "ddd": reconstructed.get("ddd", 0),
            "assets": [],
            "layers": [],
        }

        if "fonts" in reconstructed and reconstructed["fonts"]:
            fonts_data = reconstructed["fonts"]
            if isinstance(fonts_data, dict) and "list" in fonts_data:
                fonts_json = {"list": []}
                for font in fonts_data["list"]:
                    if isinstance(font, Font):
                        fonts_json["list"].append(font_to_json(font))
                    else:
                        fonts_json["list"].append(font)
                json_animation["fonts"] = fonts_json

        if "chars" in reconstructed and reconstructed["chars"]:
            chars_json = []
            for char in reconstructed["chars"]:
                if isinstance(char, Chars):
                    chars_json.append(char_to_json(char))
                else:
                    chars_json.append(char)
            json_animation["chars"] = chars_json

        def convert_layer(layer):
            if isinstance(layer, ShapeLayer):
                return shape_layer_to_json(layer)
            elif isinstance(layer, NullLayer):
                return null_layer_to_json(layer)
            elif isinstance(layer, PreCompLayer):
                return precomp_layer_to_json(layer)
            elif isinstance(layer, TextLayer):
                return text_layer_to_json(layer)
            elif isinstance(layer, SolidColorLayer):
                return solid_layer_to_json(layer)
            return layer

        for asset in reconstructed.get("assets", []):
            asset_json = dict(asset)
            if "layers" in asset:
                asset_json["layers"] = [
                    convert_layer(l) for l in asset["layers"]
                ]
            json_animation["assets"].append(asset_json)

        for layer in reconstructed.get("layers", []):
            json_animation["layers"].append(convert_layer(layer))

        # Use the full fix_lottie_json matching app.py
        json_animation = fix_lottie_json(json_animation)

        return json_animation

    @modal.fastapi_endpoint(method="GET")
    def health(self):
        return {"status": "ok", "model": "OmniLottie-4B"}
