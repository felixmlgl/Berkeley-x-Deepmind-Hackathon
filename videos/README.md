# Shared videos

The five MOV/MP4 files here are original example recordings, copied unchanged
from gardlae/Berkeley-x-DeepMind. Put future Raspberry Pi recordings in `pi/`
with unique timestamped names. This folder stores input footage; it does not
change the frontend demo scenarios or automatically upload new recordings.

From the repository root on the Pi:

```bash
mkdir -p videos/pi
rpicam-vid --nopreview --timeout 60000 \
  --width 1920 --height 1080 --framerate 30 \
  --codec libav -o "videos/pi/$(date +%Y-%m-%d_%H%M%S).mp4"
```

Once recording is complete, commit and push the desired files in `videos/pi/`.
Videos use ordinary Git, so they are included by a normal clone or pull. Keep
individual files below 100 MiB; use Git LFS or external storage for a growing
archive of large recordings.
