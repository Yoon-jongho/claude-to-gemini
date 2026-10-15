import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI } from "@google/genai";
import { writeFile, mkdir, readFile, access } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Gemini API 초기화
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// ============================================================
// 상수 및 설정
// ============================================================

const MODELS = {
  // 이미지 생성 모델 (Imagen 지원 종료 → Nano Banana 시리즈로 통합)
  NANO_BANANA_PRO: "gemini-3-pro-image",
  NANO_BANANA_2_1: "gemini-nano-banana-2.1",
  NANO_BANANA_2_LITE: "gemini-3.1-flash-lite-image",
  NANO_BANANA_2: "gemini-3.1-flash-image",
  // 텍스트/코드 모델
  FLASH: "gemini-3.5-flash",
  FLASH_3_8: "gemini-3.8-flash",
  PRO: "gemini-3.1-pro-preview",
  ARGON: "gemini-4-argon",
  // 영상 모델
  VEO_3_1: "veo-3.1-generate-preview",
  VEO_3_1_FAST: "veo-3.1-fast-generate-preview",
  VEO_3_1_LITE: "veo-3.1-lite-generate-preview",
  OMNI_FLASH: "gemini-omni-1.1-flash",
};

const ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
];

const PLATFORM_PRESETS = {
  facebook: { aspectRatio: "16:9", label: "Facebook Post/Cover (16:9)" },
  instagram: { aspectRatio: "1:1", label: "Instagram Post (1:1)" },
  twitter: { aspectRatio: "16:9", label: "Twitter/X Post (16:9)" },
  youtube: { aspectRatio: "16:9", label: "YouTube Thumbnail (16:9)" },
  linkedin: { aspectRatio: "4:5", label: "LinkedIn Post (4:5)" },
  web: { aspectRatio: "16:9", label: "Web Banner (16:9)" },
};

const SYSTEM_PROMPTS = {
  logo: (style, brandName, colorScheme) =>
    `You are a professional logo designer. Create a clean, simple, scalable logo design.
Style: ${style}.${brandName ? ` The logo must incorporate the text "${brandName}".` : ""}${colorScheme ? ` Color scheme: ${colorScheme}.` : ""}
Requirements:
- Simple enough to work at any size (favicon to billboard)
- Clean vector-style design, no photorealistic elements
- Strong silhouette and recognizable shape
- Square 1:1 composition
- No background clutter, minimal elements`,

  illustration: (style, mood) =>
    `You are an illustrator creating artwork in ${style} style.${mood ? ` The mood should be ${mood}.` : ""}
Requirements:
- Consistent artistic style throughout
- Rich visual detail appropriate to the style
- Clear focal point and composition`,

  infographic: (type, data) =>
    `You are an infographic designer specializing in clear visual communication.
Create a ${type} with excellent text rendering and visual hierarchy.${data ? `\nData to visualize: ${data}` : ""}
Requirements:
- All text must be perfectly legible and correctly spelled
- Clear visual hierarchy with headings, sections, and labels
- Professional color scheme with strong contrast
- Logical flow of information
- Use icons and visual elements to enhance understanding`,

  banner: (platform, text) => {
    const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.web;
    return `You are a marketing designer creating a ${preset.label} banner.${text ? `\nThe banner MUST prominently display this text: "${text}"` : ""}
Requirements:
- Eye-catching design optimized for ${platform}
- Text must be large, bold, and easily readable
- Strong visual hierarchy: headline text > supporting visuals > background
- Professional, modern aesthetic
- Leave breathing room around text elements`;
  },

  editImage: (action) => {
    const actionGuides = {
      modify:
        "Modify the specified elements in the image while keeping everything else intact.",
      add: "Add the described elements to the image seamlessly, matching the existing style and lighting.",
      remove:
        "Remove the specified elements cleanly, filling the area naturally.",
      style_transfer:
        "Transform the entire image into the specified artistic style while preserving the composition and content.",
      enhance:
        "Enhance the image quality, improving clarity, lighting, and overall visual appeal.",
    };
    return `You are a professional image editor. ${actionGuides[action] || actionGuides.modify}
Requirements:
- Maintain visual coherence with the original image
- Seamless integration of changes
- Preserve important elements not mentioned in the edit`;
  },

  photo: (style) => {
    const styleGuides = {
      natural:
        "natural outdoor lighting, authentic environment, candid feel",
      studio:
        "professional studio lighting, clean background, commercial quality",
      cinematic:
        "dramatic cinematic lighting, shallow depth of field, film-like color grading",
      aerial:
        "aerial/drone perspective, wide landscape view, geographic context",
      macro:
        "extreme close-up, shallow depth of field, intricate detail, bokeh background",
    };
    return styleGuides[style] || styleGuides.natural;
  },
};

// ============================================================
// 유틸리티 함수
// ============================================================

async function saveImages(images, prefix) {
  const outputDir = join(__dirname, "generated_images");
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const savedPaths = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const ext = img.mimeType.split("/")[1] || "png";
    const filename = `${prefix}_${timestamp}_${i + 1}.${ext}`;
    const filepath = join(outputDir, filename);

    const buffer = Buffer.from(img.data, "base64");
    await writeFile(filepath, buffer);
    savedPaths.push(filepath);
  }

  return savedPaths;
}


function buildImageResponse(modelLabel, prompt, images, savedPaths, extra) {
  const lines = [
    modelLabel,
    "",
    `Generated ${images.length} image(s) for: "${prompt}"`,
    "",
    "Saved to:",
    ...savedPaths.map((p) => `- ${p}`),
  ];
  if (extra) lines.push("", extra);
  return {
    content: [
      { type: "text", text: lines.join("\n") },
      ...images.map((img) => ({
        type: "image",
        data: img.data,
        mimeType: img.mimeType,
      })),
    ],
  };
}

// ============================================================
// 이미지 생성 함수 (Interactions API 통합)
// 모든 이미지 도구가 이 함수를 사용. interaction ID를 반환하여 멀티턴 지원.
// ============================================================

async function generateImage(modelName, prompt, config = {}) {
  const {
    systemPrompt,
    previousInteractionId,
    inlineImages,
    aspectRatio,
    imageSize,
    thinkingLevel,
    searchGrounding,
  } = config;

  const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

  // input 구성
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\nUser request: ${prompt}`
    : prompt;

  let input;
  if (inlineImages && inlineImages.length > 0) {
    input = [
      ...inlineImages.map((img) => ({
        type: "image",
        data: img.inlineData.data,
        mime_type: img.inlineData.mimeType,
      })),
      { type: "text", text: fullPrompt },
    ];
  } else {
    input = fullPrompt;
  }

  // body 구성
  const body = {
    model: modelName,
    input,
  };

  // response_format (top-level)
  const responseFormat = { type: "image" };
  if (aspectRatio) responseFormat.aspect_ratio = aspectRatio;
  if (imageSize) responseFormat.image_size = imageSize;
  body.response_format = responseFormat;

  // multi-turn
  if (previousInteractionId) {
    body.previous_interaction_id = previousInteractionId;
  }

  // thinking level
  if (thinkingLevel) {
    body.generation_config = { thinking_level: thinkingLevel };
  }

  // Google Search grounding (top-level tools)
  if (searchGrounding) {
    const tool = { type: "google_search" };
    if (searchGrounding === "image") {
      tool.search_types = ["image_search"];
    } else if (searchGrounding === "both") {
      tool.search_types = ["web_search", "image_search"];
    }
    body.tools = [tool];
  }

  const response = await fetch(`${BASE_URL}/interactions?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  // 이미지 추출: output_image (편의 속성) → steps 배열
  const images = [];

  // 방법 1: output_image 편의 속성
  if (result.output_image?.data) {
    images.push({
      data: result.output_image.data,
      mimeType: result.output_image.mime_type || "image/png",
    });
  }

  // 방법 2: steps에서 model_output 추출 (interleaved output 등)
  if (images.length === 0 && result.steps) {
    for (const step of result.steps) {
      if (step.type === "model_output" && step.content) {
        for (const content of step.content) {
          if (content.type === "image" && content.data) {
            images.push({
              data: content.data,
              mimeType: content.mime_type || "image/png",
            });
          }
        }
      }
    }
  }

  if (images.length === 0) {
    throw new Error(
      `No images in response. Status: ${result.status}. Response: ${JSON.stringify(result).slice(0, 500)}`
    );
  }

  return { images, interactionId: result.id };
}

// ============================================================
// MIME 타입 유틸
// ============================================================

const MIME_MAP = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

function getMimeType(filePath) {
  const ext = filePath.split(".").pop().toLowerCase();
  return MIME_MAP[ext] || "image/png";
}

async function loadImageAsInlineData(filePath) {
  let resolvedPath;
  if (filePath.startsWith("/")) {
    resolvedPath = filePath;
  } else if (filePath.includes("generated_images")) {
    resolvedPath = join(__dirname, filePath.replace(/^\.\//, ""));
  } else {
    resolvedPath = filePath;
  }

  try {
    await access(resolvedPath);
  } catch {
    throw new Error(
      `Image file not found: ${resolvedPath}. Please provide an absolute path or a path relative to the MCP server directory.`
    );
  }

  const buffer = await readFile(resolvedPath);
  return {
    inlineData: {
      mimeType: getMimeType(resolvedPath),
      data: buffer.toString("base64"),
    },
  };
}

// ============================================================
// 영상 관련 함수 (기존 유지)
// ============================================================

async function saveVideo(videoData, prefix) {
  const outputDir = join(__dirname, "generated_videos");
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${prefix}_${timestamp}.mp4`;
  const filepath = join(outputDir, filename);

  await writeFile(filepath, Buffer.from(videoData, "base64"));
  return filepath;
}

async function generateWithVeo(prompt, modelName, parameters, options = {}) {
  const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

  const instance = { prompt };

  // 첫 프레임 이미지 (image-to-video)
  if (options.imagePath) {
    const imageBuffer = await readFile(options.imagePath);
    instance.image = {
      inlineData: {
        mimeType: getMimeType(options.imagePath),
        data: imageBuffer.toString("base64"),
      },
    };
  }

  // 마지막 프레임 이미지 (시작+끝 프레임 보간)
  if (options.lastFramePath) {
    const lastBuffer = await readFile(options.lastFramePath);
    instance.lastFrame = {
      inlineData: {
        mimeType: getMimeType(options.lastFramePath),
        data: lastBuffer.toString("base64"),
      },
    };
  }

  // 레퍼런스 이미지 (최대 3개, 스타일/오브젝트 참조)
  if (options.referenceImagePaths && options.referenceImagePaths.length > 0) {
    instance.referenceImages = [];
    for (const refPath of options.referenceImagePaths.slice(0, 3)) {
      const refBuffer = await readFile(refPath);
      instance.referenceImages.push({
        referenceImage: {
          inlineData: {
            mimeType: getMimeType(refPath),
            data: refBuffer.toString("base64"),
          },
        },
        referenceType: "REFERENCE_TYPE_ASSET",
      });
    }
  }

  const body = { instances: [instance] };
  if (Object.keys(parameters).length > 0) {
    body.parameters = parameters;
  }

  const initResponse = await fetch(
    `${BASE_URL}/models/${modelName}:predictLongRunning`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw new Error(`Veo API error ${initResponse.status}: ${errorText}`);
  }

  const operation = await initResponse.json();
  const operationName = operation.name;

  const maxWaitMs = 360000;
  const pollInterval = 10000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const pollResponse = await fetch(`${BASE_URL}/${operationName}`, {
      headers: { "x-goog-api-key": apiKey },
    });

    if (!pollResponse.ok) {
      throw new Error(`Poll error: ${pollResponse.status}`);
    }

    const status = await pollResponse.json();

    if (status.error) {
      throw new Error(
        `Video generation failed: ${status.error.message || JSON.stringify(status.error)}`
      );
    }

    if (status.done) {
      const videoUri =
        status.response?.generateVideoResponse?.generatedSamples?.[0]?.video
          ?.uri;
      if (!videoUri) {
        throw new Error("Video generation completed but no video URI found");
      }

      const videoResponse = await fetch(videoUri, {
        headers: { "x-goog-api-key": apiKey },
      });

      if (!videoResponse.ok) {
        throw new Error(
          `Failed to download video: ${videoResponse.status}`
        );
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      return Buffer.from(videoBuffer).toString("base64");
    }
  }

  throw new Error("Video generation timed out after 6 minutes");
}

async function generateWithOmniVideo(prompt, config = {}) {
  const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

  const {
    imageParts,
    previousInteractionId,
    aspectRatio,
    resolution,
    delivery = "base64",
    task,
  } = config;

  // input 구성: 이미지 + 텍스트
  let input;
  if (imageParts && imageParts.length > 0) {
    input = [...imageParts, { type: "text", text: prompt }];
  } else {
    input = prompt;
  }

  const body = { model: MODELS.OMNI_FLASH, input };

  if (previousInteractionId) {
    body.previous_interaction_id = previousInteractionId;
  }

  // response_format
  const responseFormat = { type: "video" };
  if (aspectRatio) responseFormat.aspect_ratio = aspectRatio;
  if (resolution) responseFormat.resolution = resolution;
  if (delivery) responseFormat.delivery = delivery;
  body.response_format = responseFormat;

  // task (generation_config.video_config.task)
  if (task) {
    body.generation_config = {
      video_config: { task },
    };
  }

  const response = await fetch(
    `${BASE_URL}/interactions?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Omni API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  // 비디오 추출: base64 delivery → output_video.data 또는 steps
  let videoData = result.output_video?.data;
  if (!videoData) {
    const modelOutput = result.steps?.find((s) => s.type === "model_output");
    const videoContent = modelOutput?.content?.find(
      (c) => c.type === "video"
    );
    videoData = videoContent?.data;
  }

  // uri delivery → output_video.uri에서 다운로드
  if (!videoData && result.output_video?.uri) {
    const fileUri = result.output_video.uri;
    // URI 파일 상태 폴링 후 다운로드
    const maxWaitMs = 120000;
    const pollInterval = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const fileResp = await fetch(`${fileUri}?key=${apiKey}`);
      if (fileResp.ok) {
        const videoBuffer = await fileResp.arrayBuffer();
        videoData = Buffer.from(videoBuffer).toString("base64");
        break;
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  if (!videoData) {
    throw new Error(
      `No video data in response. Status: ${result.status}. Full response: ${JSON.stringify(result).slice(0, 500)}`
    );
  }

  return { data: videoData, interactionId: result.id };
}

// Imagen 모델은 지원 종료됨. 모든 이미지 생성은 Nano Banana 시리즈 Interactions API 사용.

// ============================================================
// MCP 서버 생성
// ============================================================

const server = new Server(
  {
    name: "gemini-server",
    version: "3.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================
// 도구 정의
// ============================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // --- 텍스트/코드 도구 ---
      {
        name: "ask_gemini",
        description:
          "Use Gemini for large context analysis (1M tokens), architecture design, or whole codebase review. Best for tasks requiring understanding of entire projects.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The question or task for Gemini",
            },
            context: {
              type: "string",
              description:
                "Optional: Large codebase, multiple files, or extensive context to analyze",
            },
            model: {
              type: "string",
              description:
                "Model to use: 'flash' (default, fast) or 'pro' (3.1 Pro, better quality) or 'argon' (4 Argon, most capable reasoning)",
              enum: ["flash", "pro", "argon"],
              default: "flash",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "gemini_analyze_codebase",
        description:
          "Specialized tool for analyzing entire codebases. Gemini will find patterns, duplications, architectural issues, and suggest improvements.",
        inputSchema: {
          type: "object",
          properties: {
            codebase: {
              type: "string",
              description:
                "The entire codebase or multiple files concatenated",
            },
            focus: {
              type: "string",
              description:
                "What to focus on: 'architecture', 'duplications', 'security', 'performance', or 'general'",
              enum: [
                "architecture",
                "duplications",
                "security",
                "performance",
                "general",
              ],
            },
          },
          required: ["codebase"],
        },
      },

      // --- 이미지 생성 도구 (용도별 6개) ---
      {
        name: "generate_logo",
        description:
          `Generate logos, icons, and branding assets. Uses Nano Banana Pro for professional, scalable designs with best-in-class text rendering. Outputs 1:1 square format.

Capabilities:
- Up to 4K resolution, thinking: minimal/high
- Google Search + Image Search grounding for brand research
- Best text rendering accuracy among all models

Prompt tips:
- Include brand personality (modern, playful, corporate)
- Specify color preferences explicitly
- Describe icon/symbol shape if desired
- Keep it simple: logos should work at any size (favicon to billboard)
- Provide context: 'logo for a high-end minimalist skincare brand' > 'create a logo'`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Description of the logo to generate (in English). Include brand personality, icon description, and intended use.",
            },
            brandName: {
              type: "string",
              description:
                "Brand name or text to include in the logo (optional)",
            },
            style: {
              type: "string",
              description: "Logo style",
              enum: ["minimal", "modern", "vintage", "playful", "corporate"],
              default: "modern",
            },
            colorScheme: {
              type: "string",
              description:
                "Color scheme (e.g., 'navy blue and gold', 'monochrome')",
            },
            imageSize: {
              type: "string",
              description:
                "Output resolution: '1K' (1024px, default), '2K' (2048px), '4K' (4096px)",
              enum: ["1K", "2K", "4K"],
            },
            thinkingLevel: {
              type: "string",
              description:
                "Reasoning depth: 'minimal' (fast) or 'high' (best quality, recommended for text-heavy logos). Pro model supports minimal/high only.",
              enum: ["minimal", "high"],
            },
            searchGrounding: {
              type: "string",
              description:
                "Google Search grounding: 'web' (brand trends), 'image' (visual references), 'both'. Omit to disable.",
              enum: ["web", "image", "both"],
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "generate_illustration",
        description:
          `Generate illustrations, artwork, characters, and concept art.

Models:
- nb2.1 (default): High-quality workhorse, 1K/2K/4K, thinking: minimal/medium/high
- lite: Fastest (<2s latency), cheapest, 1K only, thinking: minimal only. Best for high-volume drafts.

Prompt guidelines (6 elements for best results):
1. Subject: Be hyper-specific — 'stoic robot barista with glowing blue optics, chrome body with worn patina' > 'a robot'
2. Composition: 'extreme close-up', 'wide shot', 'low angle', 'bird's eye view', 'macro'
3. Action: 'dancing in the rain', 'contemplating the horizon', 'running through a forest'
4. Location: 'futuristic cyberpunk metropolis at night', 'sunlit alpine meadow'
5. Style: '3D animation', 'film noir', 'watercolor', '1990s product photography'
6. Editing: For follow-up refinements via edit_image

Tips:
- Describe scenes in coherent sentences, not disconnected keywords
- Use positive descriptions: say what you want, not what to avoid
- Provide context and intent: 'Create a logo for a high-end minimalist skincare brand' > 'Create a logo'
- Use camera terms: 'wide-angle shot', 'shallow depth of field', 'bokeh background'`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Description of the illustration (in English). Include: Subject (who/what), Composition (framing), Action (what's happening), Location (where), Style (aesthetic).",
            },
            style: {
              type: "string",
              description: "Art style",
              enum: [
                "watercolor",
                "cartoon",
                "vector",
                "oil_painting",
                "sketch",
                "anime",
                "pixel_art",
              ],
              default: "cartoon",
            },
            mood: {
              type: "string",
              description: "Overall mood/atmosphere",
              enum: ["cheerful", "dark", "calm", "dramatic"],
            },
            model: {
              type: "string",
              description:
                "Image model: 'nb2.1' (default, high quality, 1K-4K) or 'lite' (fastest, cheapest, 1K only)",
              enum: ["nb2.1", "lite"],
              default: "nb2.1",
            },
            aspectRatio: {
              type: "string",
              description: "Image aspect ratio",
              enum: ASPECT_RATIOS,
              default: "1:1",
            },
            numberOfImages: {
              type: "number",
              description: "Number of images to generate (1-4)",
              default: 1,
              minimum: 1,
              maximum: 4,
            },
            imageSize: {
              type: "string",
              description:
                "Output resolution: '1K' (1024px, default), '2K' (2048px, nb2.1 only), '4K' (4096px, nb2.1 only). Lite model supports 1K only.",
              enum: ["1K", "2K", "4K"],
            },
            thinkingLevel: {
              type: "string",
              description:
                "Reasoning depth. nb2.1: minimal/medium(default)/high. lite: minimal only. Use 'high' for complex multi-element scenes.",
              enum: ["minimal", "medium", "high"],
            },
            searchGrounding: {
              type: "string",
              description:
                "Google Search grounding: 'web' (text search), 'image' (image search for visual refs), 'both'. Omit to disable.",
              enum: ["web", "image", "both"],
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "generate_infographic",
        description:
          `Generate infographics, diagrams, flowcharts, and data visualizations. Uses Nano Banana Pro with best-in-class text rendering.

Capabilities:
- Professional text rendering with correct spelling and visual hierarchy
- Up to 4K resolution, thinking: minimal/high
- Google Search grounding for real-time data (stocks, weather, statistics)
- Image Search for visual reference data

Prompt tips:
- Provide structured data via 'data' parameter for accurate visualization
- Specify hierarchy: what's most important?
- Use searchGrounding='both' for real-time data + visual references
- Use thinkingLevel='high' for complex multi-section layouts
- Step-by-step: 'First show the header with title, then 3 columns of stats, then a bar chart at bottom'`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Topic or content for the infographic (in English). Describe the visual layout and data hierarchy.",
            },
            data: {
              type: "string",
              description:
                "Data or information to visualize (optional, provides structure)",
            },
            type: {
              type: "string",
              description: "Type of visual",
              enum: [
                "infographic",
                "diagram",
                "flowchart",
                "timeline",
                "comparison",
                "stats",
              ],
              default: "infographic",
            },
            aspectRatio: {
              type: "string",
              description:
                "Aspect ratio (9:16 default for vertical infographics)",
              enum: ASPECT_RATIOS,
              default: "9:16",
            },
            imageSize: {
              type: "string",
              description:
                "Output resolution: '1K' (1024px, default), '2K' (2048px), '4K' (4096px)",
              enum: ["1K", "2K", "4K"],
            },
            thinkingLevel: {
              type: "string",
              description:
                "Reasoning depth: 'minimal' (fast) or 'high' (recommended for complex layouts). Pro supports minimal/high only.",
              enum: ["minimal", "high"],
            },
            searchGrounding: {
              type: "string",
              description:
                "Google Search grounding: 'web' (real-time data), 'image' (visual refs), 'both'. Use 'web' for live statistics/trends.",
              enum: ["web", "image", "both"],
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "generate_photo",
        description:
          `Generate photorealistic images. Uses Nano Banana Pro for studio-quality results with precise detail. (Imagen models are deprecated — all photo generation now uses Nano Banana.)

Capabilities:
- Up to 4K resolution, thinking: minimal/high
- Google Search + Image Search grounding for real-world accuracy
- Best for product photos, food photography, architectural renders, portraits
- SynthID watermark included

Prompt tips:
- Specify lighting: 'natural outdoor', 'studio softbox', 'dramatic cinematic', 'golden hour'
- Include lens details: 'shallow depth of field', 'wide-angle', 'macro close-up', 'bokeh background'
- Describe texture/material: 'matte ceramic', 'brushed steel', 'fresh condensation droplets'`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Description of the photo (in English). Include subject, lighting, lens, and environment details.",
            },
            style: {
              type: "string",
              description: "Photography style",
              enum: ["natural", "studio", "cinematic", "aerial", "macro"],
              default: "natural",
            },
            numberOfImages: {
              type: "number",
              description: "Number of images to generate (1-4)",
              default: 1,
              minimum: 1,
              maximum: 4,
            },
            aspectRatio: {
              type: "string",
              description: "Image aspect ratio",
              enum: ASPECT_RATIOS,
              default: "1:1",
            },
            imageSize: {
              type: "string",
              description:
                "Output resolution: '1K' (1024px, default), '2K' (2048px), '4K' (4096px)",
              enum: ["1K", "2K", "4K"],
            },
            thinkingLevel: {
              type: "string",
              description:
                "Reasoning depth: 'minimal' (fast) or 'high' (best quality)",
              enum: ["minimal", "high"],
            },
            searchGrounding: {
              type: "string",
              description:
                "Google Search grounding: 'web', 'image' (visual refs), 'both'. Omit to disable.",
              enum: ["web", "image", "both"],
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "generate_banner",
        description:
          `Generate marketing banners and SNS images with platform-optimized sizes. Uses Nano Banana Pro for text + graphic composition with best text rendering.

Capabilities:
- Up to 4K resolution, thinking: minimal/high
- Platform presets: Facebook(16:9), Instagram(1:1), Twitter(16:9), YouTube(16:9), LinkedIn(4:5), Web(16:9)
- Google Search + Image Search grounding for trend-aware designs
- Ultra-wide (21:9, 4:1) and ultra-tall (1:4) aspect ratios supported

Prompt tips:
- Always provide display text via 'text' parameter
- Specify target audience and purpose
- Keep text short — large, bold, easily readable
- Use thinkingLevel='high' for complex text+graphic layouts`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Description of the banner design (in English). Include target audience and design intent.",
            },
            text: {
              type: "string",
              description:
                "Text to display prominently on the banner",
            },
            platform: {
              type: "string",
              description: "Target platform (determines aspect ratio)",
              enum: [
                "facebook",
                "instagram",
                "twitter",
                "youtube",
                "linkedin",
                "web",
              ],
              default: "web",
            },
            aspectRatio: {
              type: "string",
              description:
                "Override platform preset aspect ratio (optional)",
              enum: [...ASPECT_RATIOS, "4:1", "1:4"],
            },
            imageSize: {
              type: "string",
              description:
                "Output resolution: '1K' (1024px, default), '2K' (2048px), '4K' (4096px)",
              enum: ["1K", "2K", "4K"],
            },
            thinkingLevel: {
              type: "string",
              description:
                "Reasoning depth: 'minimal' (fast) or 'high' (best for text+graphic layouts). Pro supports minimal/high only.",
              enum: ["minimal", "high"],
            },
            searchGrounding: {
              type: "string",
              description:
                "Google Search grounding: 'web' (trends), 'image' (visual refs), 'both'. Omit to disable.",
              enum: ["web", "image", "both"],
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "edit_image",
        description:
          `Edit existing images with multi-turn refinement. Uses Nano Banana 2.1 (default) or Pro via Interactions API.

Models:
- nb2.1 (default): Fast, 10 object + 4 character refs, thinking: minimal/medium/high
- pro: Premium quality, 6 object + 5 character + 3 style refs, thinking: minimal/high, interleaved text+image output

Multi-turn workflow:
1. First call returns an interactionId in the response
2. Pass that interactionId as previousInteractionId for follow-up edits
3. Do NOT re-attach the previous image — the interaction already contains it
4. Each edit preserves visual consistency from prior turns
Example: "Generate office" → id:abc → "Make walls blue" (prev=abc) → id:def → "Add plants" (prev=def)

Reference images (up to 14):
- Object references: maintain product/item fidelity across scenes
- Character references: keep consistent faces/poses across images
- Style references (Pro only): apply visual style from reference to new content

Prompt guidelines (6 elements):
1. Subject: Be specific — 'stoic robot barista with glowing blue optics' > 'a robot'
2. Composition: Frame the shot — 'extreme close-up', 'wide shot', 'bird's eye view'
3. Action: What's happening — 'dancing in rain', 'contemplating the horizon'
4. Location: Where — 'cyberpunk metropolis at night', 'sunlit meadow'
5. Style: Aesthetic — '3D animation', 'film noir', 'watercolor', 'photorealistic'
6. Editing: Specific changes — 'make the sky orange', 'remove the car on the left'

Tips:
- Use positive descriptions: say what you want, not what to avoid
- Be hyper-specific: 'ornate elven plate armor with silver leaf patterns' > 'fantasy armor'
- For iterative edits: 'Keep everything the same, but make the lighting warmer'`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Editing instructions (in English). Be specific about what to change. Use the 6 prompt elements: Subject, Composition, Action, Location, Style, Editing instructions.",
            },
            imagePath: {
              type: "string",
              description:
                "Absolute or relative path to the image file to edit",
            },
            imagePaths: {
              type: "array",
              items: { type: "string" },
              description:
                "Multiple image file paths (up to 14). Use for reference images, style guides, or character consistency. NB 2.1 limits: 10 object + 4 character. Pro limits: 6 object + 5 character + 3 style.",
              maxItems: 14,
            },
            action: {
              type: "string",
              description: "Type of edit action",
              enum: [
                "modify",
                "add",
                "remove",
                "style_transfer",
                "enhance",
              ],
              default: "modify",
            },
            model: {
              type: "string",
              description:
                "Image model: 'nb2.1' (default, fast, balanced) or 'pro' (premium, best text rendering, style refs)",
              enum: ["nb2.1", "pro"],
              default: "nb2.1",
            },
            previousInteractionId: {
              type: "string",
              description:
                "Interaction ID from a previous edit_image call. Enables multi-turn editing: the model remembers previous results. Do NOT re-attach the previous output image when using this.",
            },
            aspectRatio: {
              type: "string",
              description:
                "Output aspect ratio (optional, preserves original by default)",
              enum: ASPECT_RATIOS,
            },
            imageSize: {
              type: "string",
              description:
                "Output resolution: '1K' (1024px, default), '2K' (2048px), '4K' (4096px)",
              enum: ["1K", "2K", "4K"],
            },
            thinkingLevel: {
              type: "string",
              description:
                "Reasoning depth. NB 2.1: minimal/medium(default)/high. Pro: minimal/high. Use 'high' for complex multi-element edits.",
              enum: ["minimal", "medium", "high"],
            },
            searchGrounding: {
              type: "string",
              description:
                "Google Search grounding mode: 'web' (text search for real-world context), 'image' (image search for visual references), 'both' (web + image search). Omit to disable.",
              enum: ["web", "image", "both"],
            },
          },
          required: ["prompt"],
        },
      },

      // --- 이미지 분석 도구 ---
      {
        name: "analyze_image",
        description:
          `Analyze images using Gemini 3.8 Flash. Supports captioning, object detection (bounding boxes), segmentation, visual QA, and multi-image comparison.

Capabilities:
- Image captioning and classification
- Object detection with bounding boxes ([ymin, xmin, ymax, xmax] normalized 0-1000)
- Image segmentation with polygon masks ([x, y] pairs normalized 0-1000)
- Visual question answering
- Multi-image comparison (up to 3,600 images per request)
- Text/OCR extraction from images

Supported formats: PNG, JPEG, WebP, HEIC, HEIF
Size limits: 20MB inline data per request

Tips:
- Place text prompt before images for best results
- For segmentation: use mode='segment', thinking is auto-set to minimal
- For detection: use mode='detect', describe what to find
- For general QA: use mode='caption' (default)`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Question or instruction about the image(s) (in English). E.g., 'What objects are in this image?', 'Compare these two images', 'Extract all text from this document'.",
            },
            imagePaths: {
              type: "array",
              items: { type: "string" },
              description:
                "Image file paths to analyze. Supports PNG, JPEG, WebP, HEIC, HEIF.",
            },
            mode: {
              type: "string",
              description:
                "Analysis mode: 'caption' (default, general QA/captioning), 'detect' (object detection with bounding boxes), 'segment' (segmentation with polygon masks)",
              enum: ["caption", "detect", "segment"],
              default: "caption",
            },
          },
          required: ["prompt", "imagePaths"],
        },
      },

      // --- 영상 생성 도구 ---
      {
        name: "generate_video",
        description:
          `Generate high-quality videos using Veo 3.1 with native audio. Long-running operation (1-6 min). SynthID watermark included.

Models:
- veo-3.1 (default): Best quality, 720p/1080p/4K
- veo-3.1-fast: Speed-optimized, 720p/1080p/4K
- veo-3.1-lite: Fastest, cheapest, 720p/1080p only (no 4K, no video extension)

Capabilities:
- Native audio: dialogue (use quoted text), sound effects, ambient noise
- Image-to-video: use imagePath as first frame
- First+last frame interpolation: use imagePath + lastFramePath to define start and end
- Up to 3 reference images for asset/style consistency (requires 8s duration)
- Resolution: 720p (default), 1080p (8s only), 4K (8s only, not lite)

Audio prompt tips:
- Dialogue: '"Hello, welcome!" the host says warmly'
- Sound effects: 'the sound of thunder rumbling in the distance'
- Ambient: 'quiet cafe atmosphere with soft jazz music'

Limitations:
- 1080p/4K require 8s duration
- Reference images require 8s duration
- Max prompt: 1,024 tokens`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Text description of the video (in English). Include subject, action, style, camera motion, and audio cues. Use quoted text for dialogue.",
            },
            model: {
              type: "string",
              description:
                "Veo model: 'veo-3.1' (default, best), 'veo-3.1-fast' (speed), 'veo-3.1-lite' (fastest, no 4K)",
              enum: ["veo-3.1", "veo-3.1-fast", "veo-3.1-lite"],
              default: "veo-3.1",
            },
            aspectRatio: {
              type: "string",
              description: "Video aspect ratio",
              enum: ["16:9", "9:16"],
              default: "16:9",
            },
            resolution: {
              type: "string",
              description:
                "Output resolution. 1080p/4k require 8s duration. 4k not available for lite.",
              enum: ["720p", "1080p", "4k"],
              default: "720p",
            },
            durationSeconds: {
              type: "number",
              description:
                "Duration: 4, 6, or 8 seconds. 8s required for 1080p/4k/reference images.",
              enum: [4, 6, 8],
              default: 8,
            },
            imagePath: {
              type: "string",
              description:
                "First frame image path (image-to-video mode)",
            },
            lastFramePath: {
              type: "string",
              description:
                "Last frame image path. Use with imagePath for start→end frame interpolation.",
            },
            referenceImagePaths: {
              type: "array",
              items: { type: "string" },
              description:
                "Up to 3 reference image paths for asset/style consistency. Requires 8s duration.",
              maxItems: 3,
            },
            personGeneration: {
              type: "string",
              description:
                "Person generation policy: 'allow_all' or 'allow_adult' (restricts to adults only)",
              enum: ["allow_all", "allow_adult"],
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "generate_video_omni",
        description:
          `Generate or edit videos using Gemini Omni Flash. Native multimodal model with conversational editing.

Capabilities:
- Text-to-video with native audio (dialogue, sound effects, ambient)
- Image-to-video: bring product shots, illustrations, or photos to life
- Multi-turn editing: use previousInteractionId to refine (e.g., 'make the violin invisible')
- Video extension: append seamless continuations (+10s per turn)
- Subject reference: multiple images for character/object consistency
- First+last frame interpolation: define start and end frames
- Resolution: 360p, 720p (default), 1080p, 4K (1080p/4K are upscaled)

Multi-turn workflow:
1. Generate video → returns interactionId
2. Edit: pass previousInteractionId + new prompt (model preserves unchanged elements)
3. Extend: pass previousInteractionId + task='extend' + continuation prompt

Audio prompt tips:
- Dialogue: '"Welcome!" says the host cheerfully'
- Sound: 'the crack of thunder, then steady rain'
- Music: 'calm background music with soft piano'

Limitations:
- Input videos ≤10s for editing/extension
- No editing of videos with dialogue (use multi-turn instead)
- English fully supported; other languages untested`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Text description for new video, editing instructions, or extension prompt (in English). Include audio cues for sound.",
            },
            aspectRatio: {
              type: "string",
              description: "Video aspect ratio",
              enum: ["16:9", "9:16"],
              default: "16:9",
            },
            resolution: {
              type: "string",
              description:
                "Output resolution: 360p, 720p (default), 1080p (upscaled), 4k (upscaled)",
              enum: ["360p", "720p", "1080p", "4k"],
              default: "720p",
            },
            imagePath: {
              type: "string",
              description:
                "Image file path for first frame or reference (image-to-video mode)",
            },
            lastFramePath: {
              type: "string",
              description:
                "Last frame image path. Use with imagePath for start→end frame interpolation.",
            },
            referenceImagePaths: {
              type: "array",
              items: { type: "string" },
              description:
                "Reference image paths for subject/character consistency across the video.",
              maxItems: 5,
            },
            previousInteractionId: {
              type: "string",
              description:
                "Interaction ID from a previous call. For editing: preserves unchanged elements. For extension: appends continuation.",
            },
            task: {
              type: "string",
              description:
                "Generation task hint. Usually auto-detected from input. Use 'extend' to append to previous video, 'edit' for modifications.",
              enum: ["text_to_video", "image_to_video", "reference_to_video", "edit", "extend"],
            },
          },
          required: ["prompt"],
        },
      },
    ],
  };
});

// ============================================================
// 도구 실행 핸들러
// ============================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // --- 텍스트/코드 도구 ---

    if (name === "ask_gemini") {
      const { prompt, context, model = "flash" } = args;

      const modelName =
        model === "argon"
          ? MODELS.ARGON
          : model === "pro"
            ? MODELS.PRO
            : MODELS.FLASH;

      const modelDisplayName =
        model === "argon"
          ? "4 Argon"
          : model === "pro"
            ? "3.1 Pro"
            : "3.5 Flash";

      const fullPrompt = context
        ? `Context/Codebase:\n\`\`\`\n${context}\n\`\`\`\n\nTask: ${prompt}`
        : prompt;

      const result = await ai.models.generateContent({
        model: modelName,
        contents: fullPrompt,
      });

      return {
        content: [
          {
            type: "text",
            text: `[Gemini ${modelDisplayName}]\n\n${result.text}`,
          },
        ],
      };
    }

    if (name === "gemini_analyze_codebase") {
      const { codebase, focus = "general" } = args;

      const focusPrompts = {
        architecture:
          "Analyze the overall architecture, design patterns, and structural issues. Suggest improvements.",
        duplications:
          "Find duplicated code, similar patterns, and opportunities for refactoring. Be specific.",
        security:
          "Identify security vulnerabilities, unsafe practices, and potential exploits.",
        performance:
          "Find performance bottlenecks, inefficient algorithms, and optimization opportunities.",
        general:
          "Provide a comprehensive analysis covering architecture, code quality, potential issues, and improvements.",
      };

      const prompt = `You are an expert code reviewer. Analyze this codebase with focus on: ${focus}

${focusPrompts[focus]}

Codebase:
\`\`\`
${codebase}
\`\`\`

Provide:
1. Key findings
2. Specific issues with file/line references
3. Actionable recommendations
4. Priority ranking (High/Medium/Low)`;

      const result = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: prompt,
      });

      return {
        content: [
          {
            type: "text",
            text: `[Gemini Codebase Analysis - ${focus}]\n\n${result.text}`,
          },
        ],
      };
    }

    // --- 이미지 생성 도구 ---

    if (name === "generate_logo") {
      const {
        prompt,
        brandName,
        style = "modern",
        colorScheme,
        imageSize,
        thinkingLevel,
        searchGrounding,
      } = args;

      const systemPrompt = SYSTEM_PROMPTS.logo(style, brandName, colorScheme);
      const { images, interactionId } = await generateImage(
        MODELS.NANO_BANANA_PRO,
        prompt,
        { systemPrompt, aspectRatio: "1:1", imageSize, thinkingLevel, searchGrounding }
      );

      const savedPaths = await saveImages(images, "logo");
      return buildImageResponse(
        "[Logo - Nano Banana Pro]",
        prompt,
        images,
        savedPaths,
        interactionId ? `Interaction ID: ${interactionId}\n(Use edit_image with previousInteractionId for follow-up edits)` : undefined
      );
    }

    if (name === "generate_illustration") {
      const {
        prompt,
        style = "cartoon",
        mood,
        model = "nb2.1",
        aspectRatio = "1:1",
        numberOfImages = 1,
        imageSize,
        thinkingLevel,
        searchGrounding,
      } = args;

      const modelName = model === "lite" ? MODELS.NANO_BANANA_2_LITE : MODELS.NANO_BANANA_2_1;
      const modelLabel = model === "lite" ? "Nano Banana 2 Lite" : "Nano Banana 2.1";
      const systemPrompt = SYSTEM_PROMPTS.illustration(style, mood);

      const promises = Array.from({ length: numberOfImages }, () =>
        generateImage(modelName, prompt, {
          systemPrompt,
          aspectRatio,
          imageSize,
          thinkingLevel,
          searchGrounding,
        })
      );
      const results = await Promise.all(promises);
      const allImages = results.flatMap((r) => r.images);
      const lastInteractionId = results[results.length - 1].interactionId;

      const savedPaths = await saveImages(allImages, "illustration");
      return buildImageResponse(
        `[Illustration - ${modelLabel}]`,
        prompt,
        allImages,
        savedPaths,
        lastInteractionId ? `Interaction ID: ${lastInteractionId}\n(Use edit_image with previousInteractionId for follow-up edits)` : undefined
      );
    }

    if (name === "generate_infographic") {
      const {
        prompt,
        data,
        type = "infographic",
        aspectRatio = "9:16",
        imageSize,
        thinkingLevel,
        searchGrounding,
      } = args;

      const systemPrompt = SYSTEM_PROMPTS.infographic(type, data);
      const { images, interactionId } = await generateImage(
        MODELS.NANO_BANANA_PRO,
        prompt,
        { systemPrompt, aspectRatio, imageSize, thinkingLevel, searchGrounding }
      );

      const savedPaths = await saveImages(images, "infographic");
      return buildImageResponse(
        "[Infographic - Nano Banana Pro]",
        prompt,
        images,
        savedPaths,
        interactionId ? `Interaction ID: ${interactionId}\n(Use edit_image with previousInteractionId for follow-up edits)` : undefined
      );
    }

    if (name === "generate_photo") {
      const {
        prompt,
        style = "natural",
        numberOfImages = 1,
        aspectRatio = "1:1",
        imageSize,
        thinkingLevel,
        searchGrounding,
      } = args;

      const styleHint = SYSTEM_PROMPTS.photo(style);
      const enhancedPrompt = `Photorealistic image. ${prompt}. Photography style: ${styleHint}`;

      const promises = Array.from({ length: numberOfImages }, () =>
        generateImage(MODELS.NANO_BANANA_PRO, enhancedPrompt, {
          aspectRatio,
          imageSize,
          thinkingLevel,
          searchGrounding,
        })
      );
      const results = await Promise.all(promises);
      const allImages = results.flatMap((r) => r.images);
      const lastInteractionId = results[results.length - 1].interactionId;

      const savedPaths = await saveImages(allImages, "photo");

      const responseLines = [
        "[Photo - Nano Banana Pro]",
        "",
        `Generated ${allImages.length} image(s) for: "${prompt}"`,
      ];
      if (lastInteractionId) {
        responseLines.push(
          "",
          `Interaction ID: ${lastInteractionId}`,
          "(Use edit_image with previousInteractionId for follow-up edits)"
        );
      }
      responseLines.push(
        "",
        "Saved to:",
        ...savedPaths.map((p) => `- ${p}`),
        "",
        "Note: All images include SynthID watermark."
      );

      return {
        content: [
          { type: "text", text: responseLines.join("\n") },
          ...allImages.map((img) => ({
            type: "image",
            data: img.data,
            mimeType: img.mimeType,
          })),
        ],
      };
    }

    if (name === "generate_banner") {
      const {
        prompt,
        text,
        platform = "web",
        aspectRatio: overrideRatio,
        imageSize,
        thinkingLevel,
        searchGrounding,
      } = args;

      const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.web;
      const finalRatio = overrideRatio || preset.aspectRatio;

      const systemPrompt = SYSTEM_PROMPTS.banner(platform, text);
      const { images, interactionId } = await generateImage(
        MODELS.NANO_BANANA_PRO,
        prompt,
        { systemPrompt, aspectRatio: finalRatio, imageSize, thinkingLevel, searchGrounding }
      );

      const savedPaths = await saveImages(images, "banner");
      return buildImageResponse(
        `[Banner - Nano Banana Pro | ${preset.label}]`,
        prompt,
        images,
        savedPaths,
        interactionId ? `Interaction ID: ${interactionId}\n(Use edit_image with previousInteractionId for follow-up edits)` : undefined
      );
    }

    if (name === "edit_image") {
      const {
        prompt,
        imagePath,
        imagePaths,
        action = "modify",
        model = "nb2.1",
        previousInteractionId,
        aspectRatio,
        imageSize,
        thinkingLevel,
        searchGrounding,
      } = args;

      const modelName = model === "pro" ? MODELS.NANO_BANANA_PRO : MODELS.NANO_BANANA_2_1;
      const modelLabel = model === "pro" ? "Nano Banana Pro" : "Nano Banana 2.1";

      // 인라인 이미지 로딩 (imagePath 또는 imagePaths)
      const inlineImages = [];
      if (imagePaths && imagePaths.length > 0) {
        for (const p of imagePaths) {
          inlineImages.push(await loadImageAsInlineData(p));
        }
      } else if (imagePath) {
        inlineImages.push(await loadImageAsInlineData(imagePath));
      }

      const systemPrompt = SYSTEM_PROMPTS.editImage(action);

      const { images, interactionId } = await generateImage(
        modelName,
        prompt,
        {
          systemPrompt,
          previousInteractionId,
          inlineImages: inlineImages.length > 0 ? inlineImages : undefined,
          aspectRatio,
          imageSize,
          thinkingLevel,
          searchGrounding,
        }
      );

      const savedPaths = await saveImages(images, "edited");

      const responseLines = [
        `[Edit Image - ${modelLabel} | Action: ${action}]`,
        "",
        `Generated ${images.length} image(s) for: "${prompt}"`,
      ];
      if (interactionId) {
        responseLines.push(
          "",
          `Interaction ID: ${interactionId}`,
          "(Pass this as previousInteractionId for follow-up edits)"
        );
      }
      responseLines.push("", "Saved to:", ...savedPaths.map((p) => `- ${p}`));

      return {
        content: [
          { type: "text", text: responseLines.join("\n") },
          ...images.map((img) => ({
            type: "image",
            data: img.data,
            mimeType: img.mimeType,
          })),
        ],
      };
    }

    // --- 이미지 분석 도구 ---

    if (name === "analyze_image") {
      const { prompt, imagePaths, mode = "caption" } = args;

      // 이미지 로딩
      const imageParts = [];
      for (const p of imagePaths) {
        const imgData = await loadImageAsInlineData(p);
        imageParts.push({
          type: "image",
          data: imgData.inlineData.data,
          mime_type: imgData.inlineData.mimeType,
        });
      }

      // 모드별 프롬프트 구성
      let fullPrompt = prompt;
      if (mode === "detect") {
        fullPrompt = `${prompt}\n\nReturn bounding boxes as JSON: {"boxes": [{"box_2d": [ymin, xmin, ymax, xmax], "label": "..."}]}. Coordinates normalized to 0-1000.`;
      } else if (mode === "segment") {
        fullPrompt = `${prompt}\n\nReturn segmentation masks as JSON: {"segments": [{"mask": [[x, y], ...], "label": "..."}]}. Coordinates normalized to 0-1000.`;
      }

      const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

      const body = {
        model: MODELS.FLASH_3_8,
        input: [
          ...imageParts,
          { type: "text", text: fullPrompt },
        ],
      };

      // 세그멘테이션은 thinking minimal이 더 좋은 결과
      if (mode === "segment") {
        body.generation_config = { thinking_level: "minimal" };
      }

      // detect/segment는 JSON 응답 요청
      if (mode === "detect" || mode === "segment") {
        body.response_format = {
          type: "text",
          mime_type: "application/json",
        };
      }

      const response = await fetch(`${BASE_URL}/interactions?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analyze API error ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // 텍스트 추출
      let outputText = result.output_text;
      if (!outputText) {
        const modelOutput = result.steps?.find((s) => s.type === "model_output");
        const textContent = modelOutput?.content?.find((c) => c.type === "text");
        outputText = textContent?.text || JSON.stringify(result);
      }

      const modeLabels = {
        caption: "Caption/QA",
        detect: "Object Detection",
        segment: "Segmentation",
      };

      return {
        content: [
          {
            type: "text",
            text: `[Image Analysis - Gemini 3.8 Flash | ${modeLabels[mode]}]\n\n${outputText}`,
          },
        ],
      };
    }

    // --- 영상 생성 도구 ---

    if (name === "generate_video") {
      const {
        prompt,
        model = "veo-3.1",
        aspectRatio = "16:9",
        resolution = "720p",
        durationSeconds = 8,
        imagePath,
        lastFramePath,
        referenceImagePaths,
        personGeneration,
      } = args;

      const modelMap = {
        "veo-3.1": MODELS.VEO_3_1,
        "veo-3.1-fast": MODELS.VEO_3_1_FAST,
        "veo-3.1-lite": MODELS.VEO_3_1_LITE,
      };
      const modelName = modelMap[model] || MODELS.VEO_3_1;

      const parameters = { aspectRatio, resolution };
      if (durationSeconds) {
        parameters.durationSeconds = String(durationSeconds);
      }
      if (personGeneration) {
        parameters.personGeneration = personGeneration;
      }

      // 이미지 경로 해석 + 존재 확인
      const resolveAndVerify = async (p) => {
        const resolved = p.startsWith("/") ? p : join(__dirname, p);
        try { await access(resolved); } catch { throw new Error(`File not found: ${resolved}`); }
        return resolved;
      };

      const options = {};
      if (imagePath) options.imagePath = await resolveAndVerify(imagePath);
      if (lastFramePath) options.lastFramePath = await resolveAndVerify(lastFramePath);
      if (referenceImagePaths && referenceImagePaths.length > 0) {
        options.referenceImagePaths = [];
        for (const p of referenceImagePaths) {
          options.referenceImagePaths.push(await resolveAndVerify(p));
        }
      }

      const videoData = await generateWithVeo(prompt, modelName, parameters, options);
      const savedPath = await saveVideo(videoData, "veo");

      const features = [aspectRatio, resolution, `${durationSeconds}s`];
      if (options.imagePath) features.push("image-to-video");
      if (options.lastFramePath) features.push("first+last frame");
      if (options.referenceImagePaths) features.push(`${options.referenceImagePaths.length} ref images`);

      return {
        content: [
          {
            type: "text",
            text: `[Video - Veo ${model}]\n\nGenerated video for: "${prompt}"\n\nSettings: ${features.join(" | ")}\n\nSaved to:\n- ${savedPath}\n\nNote: Videos include SynthID watermark. Server-side copies expire after 2 days.`,
          },
        ],
      };
    }

    if (name === "generate_video_omni") {
      const {
        prompt,
        aspectRatio = "16:9",
        resolution = "720p",
        imagePath,
        lastFramePath,
        referenceImagePaths,
        previousInteractionId,
        task,
      } = args;

      // 이미지 파트 구성 (첫 프레임 + 마지막 프레임 + 레퍼런스)
      const resolveAndVerify = async (p) => {
        const resolved = p.startsWith("/") ? p : join(__dirname, p);
        try { await access(resolved); } catch { throw new Error(`File not found: ${resolved}`); }
        return resolved;
      };

      const imageParts = [];

      // 레퍼런스 이미지
      if (referenceImagePaths && referenceImagePaths.length > 0) {
        for (const p of referenceImagePaths) {
          const resolved = await resolveAndVerify(p);
          const buffer = await readFile(resolved);
          imageParts.push({
            type: "image",
            data: buffer.toString("base64"),
            mime_type: getMimeType(resolved),
          });
        }
      }

      // 첫 프레임
      if (imagePath) {
        const resolved = await resolveAndVerify(imagePath);
        const buffer = await readFile(resolved);
        imageParts.push({
          type: "image",
          data: buffer.toString("base64"),
          mime_type: getMimeType(resolved),
        });
      }

      // 마지막 프레임
      if (lastFramePath) {
        const resolved = await resolveAndVerify(lastFramePath);
        const buffer = await readFile(resolved);
        imageParts.push({
          type: "image",
          data: buffer.toString("base64"),
          mime_type: getMimeType(resolved),
        });
      }

      const { data, interactionId } = await generateWithOmniVideo(prompt, {
        imageParts: imageParts.length > 0 ? imageParts : undefined,
        previousInteractionId,
        aspectRatio,
        resolution,
        task,
      });
      const savedPath = await saveVideo(data, "omni");

      const actionLabel = task === "extend"
        ? "Extended"
        : previousInteractionId
          ? "Edited"
          : "Generated";

      const features = [aspectRatio, resolution];
      if (imagePath) features.push("image-to-video");
      if (lastFramePath) features.push("first+last frame");
      if (referenceImagePaths?.length) features.push(`${referenceImagePaths.length} ref images`);
      if (task) features.push(`task: ${task}`);

      return {
        content: [
          {
            type: "text",
            text: `[Video - Gemini Omni Flash]\n\n${actionLabel} video for: "${prompt}"\n\nSettings: ${features.join(" | ")}\n\nSaved to:\n- ${savedPath}\n\nInteraction ID: ${interactionId}\n(Pass this as previousInteractionId to edit or extend this video)`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================
// 서버 시작
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Gemini MCP server running (v3.0.0)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
