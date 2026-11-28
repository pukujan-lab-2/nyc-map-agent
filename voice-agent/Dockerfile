# syntax=docker/dockerfile:1.7
# nyc-map-agent's voice call worker (agent.py), copied from design-bakery's. Hush's library is built from its source here, not taken prebuilt from its repo.

# Hush: libweya_nc from pulp-vision/Hush at a fixed commit (native/weya_nc_build, Rust over DeepFilterNet's tract runtime).
FROM rust:1.85-slim-bookworm AS hush
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
ARG HUSH_COMMIT=9f6414e91461a8f4bdf9840c0cdcdcb7da986339
RUN GIT_LFS_SKIP_SMUDGE=1 git clone --filter=blob:none https://github.com/pulp-vision/Hush.git /hush && git -C /hush checkout -q $HUSH_COMMIT
WORKDIR /hush/native/weya_nc_build/weya_nc
# Hush's release profile links with fat LTO in one codegen unit, which needs more memory than a small build VM has
# (tract-core was killed): thin LTO and a few jobs at a time make the same library.
ENV CARGO_PROFILE_RELEASE_LTO=thin CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 CARGO_BUILD_JOBS=2
RUN cargo build --release --locked && cp target/release/libweya_nc.so /libweya_nc.so

FROM python:3.12-slim-bookworm
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Hush's model (huggingface.co/weya-ai/hush, Apache 2.0) and the voice match's speaker model (3D-Speaker ERes2Net, Apache 2.0,
# from sherpa-onnx's releases), pinned by checksum.
# The speaker model was re-uploaded on 2026-11-19 (re-exported with PyTorch 2.14.1 instead of 2.4.1): compared with the file
# pinned before (c5915837...), its 191 weight tensors and 516 graph nodes are identical; only the producer version differs.
ADD --checksum=sha256:45632ccaa82b71bb743d6caa7c78e983fe2f2790a3af7f6ec48e6ed7ba085df6 \
    https://huggingface.co/weya-ai/hush/resolve/a55d932cbf6344d284ac985f21e7f6e5bc4d38a5/onnx/advanced_dfnet16k_model_best_onnx.tar.gz /opt/models/hush.tar.gz
ADD --checksum=sha256:c4947caf150b8502fdd75bbe4089b971ab1ec42e90ee3ba547faca2cde44d9ee \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_eres2net_sv_en_voxceleb_16k.onnx /opt/models/voice-match.onnx
COPY --from=hush /libweya_nc.so /opt/hush/libweya_nc.so
ENV HUSH_LIB=/opt/hush/libweya_nc.so HUSH_MODEL=/opt/models/hush.tar.gz VOICE_MATCH_MODEL=/opt/models/voice-match.onnx PYTHONUNBUFFERED=1
COPY *.py stacks.json ./
# The voice detector and the turn detector's weights, into the image so a call never waits on a download.
RUN python agent.py download-files
CMD ["python", "agent.py", "start"]
