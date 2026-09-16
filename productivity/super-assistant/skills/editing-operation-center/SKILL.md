---
name: editing-operation-center
description: Create and edit local JianYing/CapCut video drafts through JSON command-line tools without starting an MCP or HTTP service. Use when an Agent needs to create a draft, add video/audio/images/text/SRT subtitles/effects/stickers/keyframes, inspect supported editing resources, analyze media duration, or export an editable JianYing/CapCut project.
---

# VectCut 本地视频剪辑

直接调用 `scripts/vectcut.py`。

## 首次安装

必须使用 Anaconda/Miniconda 创建独立环境。不要把依赖安装到系统 Python。

```bash
conda create -n vectcut-tools python=3.11 -y
conda activate vectcut-tools
python -m pip install --upgrade pip
python -m pip install -r "/绝对路径/vectcut-video-editor/requirements.txt"
conda install -n vectcut-tools -c conda-forge ffmpeg=7.1 -y
```

`requirements.txt` 固定所有直接使用的 Python 包版本。FFmpeg/ffprobe 是系统可执行程序，不是 Python 包，因此通过 Conda 单独安装。

验证环境：

```bash
conda run -n vectcut-tools python -c "import imageio, requests; print('python dependencies: OK')"
conda run -n vectcut-tools ffprobe -version
```

后续命令优先使用 `conda run -n vectcut-tools`，避免 Agent 的非交互 shell 无法继承 `conda activate` 状态。

## 调用约定

把包含本文件的目录记为 `SKILL_DIR`，统一入口为：

```text
<SKILL_DIR>/scripts/vectcut.py
```

为每项视频任务选择一个绝对工作目录 `WORKSPACE`，并在同一草稿的所有调用中保持不变。工具输出 JSON；始终检查顶层 `success`。

查看全部工具：

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" list-tools
```

查看单个工具的完整参数、默认值和类型：

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" list-tools --tool add_video
```

调用工具：

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" run <工具名> --params '<JSON对象>'
```

复杂文本、SRT 内容或包含特殊字符的路径应写入 JSON 文件，再使用 `--params-file`。传 `--params-file -` 可从标准输入读取 JSON。不要直接编辑 `.vectcut/state/*.pickle`。

## 草稿与版本

支持以下草稿 profile：

- `capcut_legacy`：CapCut，默认值
- `jianying_legacy`：旧版剪映草稿
- `jianying_pro_10`：剪映专业版 10.x 草稿

创建时把 `--profile` 放在子命令之前：

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" --profile jianying_pro_10 \
  run create_draft --params '{"width":1080,"height":1920}'
```

保存返回的 `result.draft_id`。后续调用传相同的 `draft_id` 和 `WORKSPACE`；工具会从 `.vectcut/state/` 自动恢复草稿和 profile。不要并发修改同一个草稿。

## 工具分类

草稿工具：

- `create_draft`：创建草稿并设置画布宽高。
- `list_drafts`：列出当前工作目录中已持久化的草稿。
- `inspect_draft`：返回草稿的完整 JSON，用于验证轨道和素材。
- `save_draft`：下载/复制素材并生成可导入剪映或 CapCut 的草稿目录。

媒体工具：

- `add_video`：添加视频；支持裁剪、时间轴位置、速度、音量、缩放、转场、蒙版和背景模糊。
- `add_audio`：添加音频；支持裁剪、时间轴位置、速度、音量和音效。
- `add_image`：添加图片；支持持续时间、位置、缩放、入场/出场/组合动画、转场、蒙版和背景模糊。
- `get_video_duration`：使用 ffprobe 获取本地文件或 URL 的媒体时长。

文字工具：

- `add_text`：添加文字；支持字体、颜色、透明度、描边、背景、阴影、花字、气泡、动画和局部多样式。
- `add_subtitle`：从本地 SRT、SRT URL 或直接传入的 SRT 文本添加字幕。

效果工具：

- `add_effect`：添加 `scene` 或 `character` 类视频特效。
- `add_sticker`：使用剪映/CapCut 资源 ID 添加贴纸。
- `add_video_keyframe`：给视频轨道添加单个或批量关键帧。

资源查询工具：

- `get_intro_animation_types`
- `get_outro_animation_types`
- `get_combo_animation_types`
- `get_transition_types`
- `get_mask_types`
- `get_audio_effect_types`
- `get_font_types`
- `get_text_intro_types`
- `get_text_outro_types`
- `get_text_loop_anim_types`
- `get_video_scene_effect_types`
- `get_video_character_effect_types`

先运行相应查询工具，再把返回的 `name` 原样传给剪辑工具。资源列表会根据草稿 profile 自动切换。

## 标准工作流

### 1. 创建草稿

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" run create_draft \
  --params '{"width":1080,"height":1920}'
```

从结果中记录：

```json
{
  "draft_id": "dfd_cat_...",
  "state_path": "<WORKSPACE>/.vectcut/state/dfd_cat_....pickle"
}
```

### 2. 添加视频

`start`、`end` 表示源素材裁剪范围，`target_start` 表示时间轴起点，单位均为秒。若不传 `end`，保存时使用 ffprobe 获取真实时长。已知时长时可传 `duration`，减少探测。

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" run add_video --params '{
    "draft_id":"dfd_cat_...",
    "video_url":"/绝对路径/background.mp4",
    "start":0,
    "end":8,
    "target_start":0,
    "track_name":"main",
    "volume":0.8,
    "transition":"叠化",
    "transition_duration":0.5
  }'
```

视频与音频可使用本地绝对路径或 HTTP(S) URL。图片、字幕同样支持本地路径或 URL。

### 3. 添加音频或图片

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" run add_audio --params '{
    "draft_id":"dfd_cat_...",
    "audio_url":"/绝对路径/music.mp3",
    "target_start":0,
    "volume":0.5,
    "track_name":"music"
  }'
```

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" run add_image --params '{
    "draft_id":"dfd_cat_...",
    "image_url":"/绝对路径/cover.png",
    "start":0,
    "end":3,
    "track_name":"overlay",
    "intro_animation":"渐显",
    "intro_animation_duration":0.4
  }'
```

动画、转场和蒙版名称必须先通过对应 `get_*_types` 工具确认；不同 profile 的名称可能不同。

### 4. 添加文字

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" run add_text --params '{
    "draft_id":"dfd_cat_...",
    "text":"AI 驱动的视频剪辑",
    "start":0.5,
    "end":4,
    "font_size":10,
    "font_color":"#FFFFFF",
    "transform_y":-0.75,
    "border_width":6,
    "border_color":"#000000",
    "shadow_enabled":true
  }'
```

`text_styles` 使用字符下标的左闭右开区间：

```json
{
  "text_styles": [
    {
      "start": 0,
      "end": 2,
      "font_color": "#FF4D4F",
      "font_size": 12,
      "bold": true
    }
  ]
}
```

确保 `0 <= start < end <= 文本字符数`。

### 5. 添加 SRT 字幕

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" run add_subtitle --params '{
    "draft_id":"dfd_cat_...",
    "srt_path":"/绝对路径/subtitles.srt",
    "track_name":"subtitle",
    "font_size":8,
    "font_color":"#FFFFFF",
    "border_width":5,
    "transform_y":-0.8,
    "vertical":false
  }'
```

`time_offset` 以秒为单位，可整体平移字幕。

### 6. 添加特效、贴纸或关键帧

先查询资源名：

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" run get_video_scene_effect_types --params '{}'
```

添加特效：

```json
{
  "draft_id": "dfd_cat_...",
  "effect_type": "<查询返回的 name>",
  "effect_category": "scene",
  "start": 0,
  "end": 3,
  "track_name": "effect_01"
}
```

批量关键帧的三个数组长度必须一致：

```json
{
  "draft_id": "dfd_cat_...",
  "track_name": "main",
  "property_types": ["scale_x", "scale_y", "alpha"],
  "times": [0, 1.5, 3],
  "values": ["1.0", "1.2", "0.8"]
}
```

### 7. 检查并保存

先检查草稿：

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" run inspect_draft \
  --params '{"draft_id":"dfd_cat_..."}'
```

再保存：

```bash
conda run -n vectcut-tools python "<SKILL_DIR>/scripts/vectcut.py" \
  --workspace "<WORKSPACE>" run save_draft \
  --params '{"draft_id":"dfd_cat_..."}'
```

默认输出到 `<WORKSPACE>/drafts/<draft_id>/`。可在参数中传 `output_dir` 指定父目录。读取 `result.draft_path`，将该草稿目录复制到剪映/CapCut 的草稿项目目录，或直接使用已指向该项目目录的 `output_dir`。

## 错误处理

- 顶层 `success=false` 时停止后续编辑，读取 `error` 和 `error_type`。
- 调试时在子命令之前添加 `--verbose`，读取 `logs` 或 `traceback`。
- 出现 `ffprobe command not found` 时，在 `vectcut-tools` Conda 环境中重新安装 FFmpeg。
- 出现 `Draft state ... was not found` 时，检查 `WORKSPACE` 与 `draft_id` 是否来自同一次任务。
- 出现资源名不支持时，使用当前 profile 重新运行对应 `get_*_types` 查询。
- 保存网络素材失败时，先确认 URL 可访问；必要时下载为本地文件并改传绝对路径。
