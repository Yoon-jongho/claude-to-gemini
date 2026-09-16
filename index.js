import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

const genAI = new GoogleGenerativeAI(apiKey);

// ============================================================
// 상수 및 설정
// ============================================================

const MODELS = {
  NANO_BANANA_PRO: "gemini-3-pro-image-preview",
  NANO_BANANA_2: "gemini-3.1-flash-image-preview",
  IMAGEN_4: "imagen-4.0-generate-001",
  FLASH: "gemini-3.5-flash",
  PRO: "gemini-3.1-pro-preview",
  VEO_3_1: "veo-3.1-generate-preview",
  VEO_3_1_FAST: "veo-3.1-fast-generate-preview",
  VEO_3_1_LITE: "veo-3.1-lite-generate-preview",
  OMNI_FLASH: "gemini-omni-1.1-flash",
};

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
// 공통 유틸리티 함수
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

function extractImages(response) {
  const parts = response.candidates?.[0]?.content?.parts?.filter(
    (part) => part.inlineData
  );
  if (!parts || parts.length === 0) {
    throw new Error("No images were generated");
  }
  return parts.map((p) => ({
    data: p.inlineData.data,
    mimeType: p.inlineData.mimeType,
  }));
}

function buildImageResponse(modelLabel, prompt, images, savedPaths, note) {
  return {
    content: [
      {
        type: "text",
        text: `${modelLabel}\n\nGenerated ${images.length} image(s) for: "${prompt}"\n\nSaved to:\n${savedPaths.map((p) => `- ${p}`).join("\n")}${note ? `\n\n${note}` : ""}`,
      },
      ...images.map((img) => ({
        type: "image",
        data: img.data,
        mimeType: img.mimeType,
      })),
    ],
  };
}

async function generateWithNanoBanana(
  modelName,
  systemPrompt,
  userPrompt,
  imageConfig,
  inlineImages
) {
  const model = genAI.getGenerativeModel({ model: modelName });

  const parts = [];
  if (inlineImages && inlineImages.length > 0) {
    parts.push(...inlineImages);
  }
  // 시스템 프롬프트를 유저 프롬프트 앞에 텍스트로 합침 (이미지 모델 호환성)
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\nUser request: ${userPrompt}`
    : userPrompt;
  parts.push({ text: fullPrompt });

  const generationConfig = {
    responseModalities: ["image", "text"],
  };
  if (imageConfig) {
    generationConfig.imageConfig = imageConfig;
  }

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig,
  });

  return extractImages(result.response);
}

async function saveVideo(videoData, prefix) {
  const outputDir = join(__dirname, "generated_videos");
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${prefix}_${timestamp}.mp4`;
  const filepath = join(outputDir, filename);

  await writeFile(filepath, Buffer.from(videoData, "base64"));
  return filepath;
}

async function generateWithVeo(prompt, modelName, parameters, imagePath) {
  const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

  const instance = { prompt };
  if (imagePath) {
    const imageBuffer = await readFile(imagePath);
    const base64Data = imageBuffer.toString("base64");
    const ext = imagePath.split(".").pop().toLowerCase();
    const mimeMap = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    instance.image = {
      inlineData: {
        mimeType: mimeMap[ext] || "image/jpeg",
        data: base64Data,
      },
    };
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

  // Poll until done (max 6 minutes)
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

async function generateWithOmniVideo(
  prompt,
  config,
  imageParts,
  previousInteractionId
) {
  const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

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

  const responseFormat = { type: "video" };
  if (config.aspectRatio) responseFormat.aspect_ratio = config.aspectRatio;
  if (config.resolution) responseFormat.resolution = config.resolution;
  body.response_format = responseFormat;

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

  // SDK-style output_video 먼저 시도, 없으면 steps 배열에서 추출 (REST 방식)
  let videoData = result.output_video?.data;
  if (!videoData) {
    const modelOutput = result.steps?.find((s) => s.type === "model_output");
    const videoContent = modelOutput?.content?.find(
      (c) => c.type === "video"
    );
    videoData = videoContent?.data;
  }

  if (!videoData) {
    throw new Error(
      `No video data in response. Status: ${result.status}. Full response: ${JSON.stringify(result).slice(0, 500)}`
    );
  }

  return { data: videoData, interactionId: result.id };
}

async function generateWithImagen(prompt, sampleCount, aspectRatio) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.IMAGEN_4}:predict`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount,
          ...(aspectRatio && { aspectRatio }),
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imagen API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  if (!result.predictions || result.predictions.length === 0) {
    throw new Error(
      `No images were generated. Response: ${JSON.stringify(result)}`
    );
  }

  return result.predictions.map((img) => ({
    data: img.bytesBase64Encoded,
    mimeType: img.mimeType || "image/png",
  }));
}

// ============================================================
// MCP 서버 생성
// ============================================================

const server = new Server(
  {
    name: "gemini-server",
    version: "2.1.0",
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
      // --- 텍스트/코드 도구 (기존 유지) ---
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
                "Model to use: 'flash' (default, fast) or 'pro' (3.1 Pro, better quality)",
              enum: ["flash", "pro"],
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
          "Generate logos, icons, and branding assets. Uses Nano Banana Pro for professional, scalable designs. Outputs 1:1 square format.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Description of the logo to generate (in English)",
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
          },
          required: ["prompt"],
        },
      },
      {
        name: "generate_illustration",
        description:
          "Generate illustrations, artwork, characters, and concept art. Uses Nano Banana 2 (FREE). Best for creative exploration and iterative design.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Description of the illustration (in English)",
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
            aspectRatio: {
              type: "string",
              description: "Image aspect ratio",
              enum: ["1:1", "16:9", "9:16", "4:3", "3:4"],
              default: "1:1",
            },
            numberOfImages: {
              type: "number",
              description: "Number of images to generate (1-4)",
              default: 1,
              minimum: 1,
              maximum: 4,
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "generate_infographic",
        description:
          "Generate infographics, diagrams, flowcharts, and data visualizations. Uses Nano Banana Pro with optimized text rendering for clear, readable visuals.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Topic or content for the infographic (in English)",
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
              enum: ["9:16", "1:1", "16:9", "3:4"],
              default: "9:16",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "generate_photo",
        description:
          "Generate photorealistic images using Imagen 4. Best for product photos, food photography, and commercial-grade images. Paid service with SynthID watermark.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Description of the photo (in English)",
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
              enum: ["1:1", "16:9", "9:16", "4:3", "3:4"],
              default: "1:1",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "generate_banner",
        description:
          "Generate marketing banners and SNS images with platform-optimized sizes. Uses Nano Banana Pro for text + graphic composition.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Description of the banner design (in English)",
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
              enum: ["1:1", "16:9", "9:16", "4:3", "3:4", "4:5", "21:9"],
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "edit_image",
        description:
          "Edit existing images: modify, add, remove elements, style transfer, or enhance. Uses Nano Banana 2 (FREE). Requires an image file path.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Editing instructions (in English)",
            },
            imagePath: {
              type: "string",
              description:
                "Absolute or relative path to the image file to edit",
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
          },
          required: ["prompt", "imagePath"],
        },
      },

      // --- 영상 생성 도구 ---
      {
        name: "generate_video",
        description:
          "Generate high-quality videos using Veo 3.1 with native audio. Supports text-to-video and image-to-video. Videos are 4-8 seconds long. Note: this is a long-running operation (typically 1-6 minutes). Generated videos include SynthID watermark.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Text description of the video to generate (in English). Include subject, action, style, camera motion, and audio cues for best results.",
            },
            model: {
              type: "string",
              description:
                "Veo model variant: 'veo-3.1' (default, best quality), 'veo-3.1-fast' (optimized for speed), 'veo-3.1-lite' (fastest, no 4k support)",
              enum: ["veo-3.1", "veo-3.1-fast", "veo-3.1-lite"],
              default: "veo-3.1",
            },
            aspectRatio: {
              type: "string",
              description:
                "Video aspect ratio: '16:9' (landscape, default) or '9:16' (portrait)",
              enum: ["16:9", "9:16"],
              default: "16:9",
            },
            resolution: {
              type: "string",
              description:
                "Output resolution. '720p' (default), '1080p' (8s duration only), '4k' (8s duration only, not available for lite model)",
              enum: ["720p", "1080p", "4k"],
              default: "720p",
            },
            durationSeconds: {
              type: "number",
              description:
                "Video duration: 4, 6, or 8 seconds. 1080p and 4k require 8s.",
              enum: [4, 6, 8],
              default: 8,
            },
            imagePath: {
              type: "string",
              description:
                "Optional: absolute path to an image file to use as the first frame (image-to-video mode)",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "generate_video_omni",
        description:
          "Generate or edit videos using Gemini Omni Flash. Faster than Veo with conversational editing support. Use previousInteractionId for stateful multi-turn video editing (e.g., generate then refine). Supports text-to-video and image-to-video.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Text description for new video, or editing instructions for existing video (in English)",
            },
            aspectRatio: {
              type: "string",
              description:
                "Video aspect ratio: '16:9' (landscape, default) or '9:16' (portrait)",
              enum: ["16:9", "9:16"],
              default: "16:9",
            },
            resolution: {
              type: "string",
              description:
                "Output resolution: '360p', '720p' (default), or '1080p'",
              enum: ["360p", "720p", "1080p"],
              default: "720p",
            },
            imagePath: {
              type: "string",
              description:
                "Optional: absolute path to an image file to use as reference or starting frame",
            },
            previousInteractionId: {
              type: "string",
              description:
                "Optional: interaction ID returned by a previous generate_video_omni call, for stateful video editing",
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
        model === "pro" ? MODELS.PRO : MODELS.FLASH;

      const geminiModel = genAI.getGenerativeModel({ model: modelName });

      const fullPrompt = context
        ? `Context/Codebase:\n\`\`\`\n${context}\n\`\`\`\n\nTask: ${prompt}`
        : prompt;

      const result = await geminiModel.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      return {
        content: [
          {
            type: "text",
            text: `[Gemini ${model === "pro" ? "3.1 Pro" : "3.5 Flash"}]\n\n${text}`,
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

      const model = genAI.getGenerativeModel({ model: MODELS.FLASH });

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

      const result = await model.generateContent(prompt);
      const response = await result.response;

      return {
        content: [
          {
            type: "text",
            text: `[Gemini Codebase Analysis - ${focus}]\n\n${response.text()}`,
          },
        ],
      };
    }

    // --- 이미지 생성 도구 ---

    if (name === "generate_logo") {
      const { prompt, brandName, style = "modern", colorScheme } = args;

      const systemPrompt = SYSTEM_PROMPTS.logo(style, brandName, colorScheme);
      const images = await generateWithNanoBanana(
        MODELS.NANO_BANANA_PRO,
        systemPrompt,
        prompt,
        { aspectRatio: "1:1" }
      );

      const savedPaths = await saveImages(images, "logo");
      return buildImageResponse(
        "[Logo - Nano Banana Pro]",
        prompt,
        images,
        savedPaths
      );
    }

    if (name === "generate_illustration") {
      const {
        prompt,
        style = "cartoon",
        mood,
        aspectRatio = "1:1",
        numberOfImages = 1,
      } = args;

      const systemPrompt = SYSTEM_PROMPTS.illustration(style, mood);

      // numberOfImages > 1이면 병렬 호출
      const promises = Array.from({ length: numberOfImages }, () =>
        generateWithNanoBanana(
          MODELS.NANO_BANANA_2,
          systemPrompt,
          prompt,
          { aspectRatio }
        )
      );
      const results = await Promise.all(promises);
      const allImages = results.flat();

      const savedPaths = await saveImages(allImages, "illustration");
      return buildImageResponse(
        "[Illustration - Nano Banana 2 (Free)]",
        prompt,
        allImages,
        savedPaths
      );
    }

    if (name === "generate_infographic") {
      const {
        prompt,
        data,
        type = "infographic",
        aspectRatio = "9:16",
      } = args;

      const systemPrompt = SYSTEM_PROMPTS.infographic(type, data);
      const images = await generateWithNanoBanana(
        MODELS.NANO_BANANA_PRO,
        systemPrompt,
        prompt,
        { aspectRatio }
      );

      const savedPaths = await saveImages(images, "infographic");
      return buildImageResponse(
        "[Infographic - Nano Banana Pro]",
        prompt,
        images,
        savedPaths
      );
    }

    if (name === "generate_photo") {
      const {
        prompt,
        style = "natural",
        numberOfImages = 1,
        aspectRatio = "1:1",
      } = args;

      const styleHint = SYSTEM_PROMPTS.photo(style);
      const enhancedPrompt = `${prompt}. Photography style: ${styleHint}`;

      const images = await generateWithImagen(
        enhancedPrompt,
        numberOfImages,
        aspectRatio
      );
      const savedPaths = await saveImages(images, "photo");
      return buildImageResponse(
        "[Photo - Imagen 4]",
        prompt,
        images,
        savedPaths,
        "Note: All images include SynthID watermark for authenticity."
      );
    }

    if (name === "generate_banner") {
      const {
        prompt,
        text,
        platform = "web",
        aspectRatio: overrideRatio,
      } = args;

      const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.web;
      const finalRatio = overrideRatio || preset.aspectRatio;

      const systemPrompt = SYSTEM_PROMPTS.banner(platform, text);
      const images = await generateWithNanoBanana(
        MODELS.NANO_BANANA_PRO,
        systemPrompt,
        prompt,
        { aspectRatio: finalRatio }
      );

      const savedPaths = await saveImages(images, "banner");
      return buildImageResponse(
        `[Banner - Nano Banana Pro | ${preset.label}]`,
        prompt,
        images,
        savedPaths
      );
    }

    if (name === "edit_image") {
      const { prompt, imagePath, action = "modify" } = args;

      // 경로 해석
      let resolvedPath;
      if (imagePath.startsWith("/")) {
        resolvedPath = imagePath;
      } else if (imagePath.includes("generated_images")) {
        resolvedPath = join(__dirname, imagePath.replace(/^\.\//, ""));
      } else {
        resolvedPath = imagePath;
      }

      // 파일 존재 확인
      try {
        await access(resolvedPath);
      } catch {
        throw new Error(
          `Image file not found: ${resolvedPath}. Please provide an absolute path or a path relative to the MCP server directory.`
        );
      }

      // 이미지 읽기 + base64 변환
      const imageBuffer = await readFile(resolvedPath);
      const base64Data = imageBuffer.toString("base64");

      const ext = resolvedPath.split(".").pop().toLowerCase();
      const mimeMap = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
      };
      const mimeType = mimeMap[ext] || "image/png";

      const systemPrompt = SYSTEM_PROMPTS.editImage(action);
      const inlineImages = [{ inlineData: { mimeType, data: base64Data } }];

      const images = await generateWithNanoBanana(
        MODELS.NANO_BANANA_2,
        systemPrompt,
        prompt,
        null,
        inlineImages
      );

      const savedPaths = await saveImages(images, "edited");
      return buildImageResponse(
        `[Edit Image - Nano Banana 2 (Free) | Action: ${action}]`,
        prompt,
        images,
        savedPaths
      );
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

      let resolvedImagePath;
      if (imagePath) {
        resolvedImagePath = imagePath.startsWith("/")
          ? imagePath
          : join(__dirname, imagePath);
        try {
          await access(resolvedImagePath);
        } catch {
          throw new Error(`Image file not found: ${resolvedImagePath}`);
        }
      }

      const videoData = await generateWithVeo(
        prompt,
        modelName,
        parameters,
        resolvedImagePath
      );
      const savedPath = await saveVideo(videoData, "veo");

      return {
        content: [
          {
            type: "text",
            text: `[Video - Veo ${model}]\n\nGenerated video for: "${prompt}"\n\nSettings: ${aspectRatio} | ${resolution} | ${durationSeconds}s${resolvedImagePath ? " | image-to-video" : ""}\n\nSaved to:\n- ${savedPath}\n\nNote: Videos include SynthID watermark. Server-side copies expire after 2 days.`,
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
        previousInteractionId,
      } = args;

      let imageParts;
      if (imagePath) {
        const resolvedPath = imagePath.startsWith("/")
          ? imagePath
          : join(__dirname, imagePath);
        try {
          await access(resolvedPath);
        } catch {
          throw new Error(`Image file not found: ${resolvedPath}`);
        }
        const imageBuffer = await readFile(resolvedPath);
        const base64Data = imageBuffer.toString("base64");
        const ext = resolvedPath.split(".").pop().toLowerCase();
        const mimeMap = {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          webp: "image/webp",
        };
        imageParts = [
          {
            type: "image",
            data: base64Data,
            mime_type: mimeMap[ext] || "image/jpeg",
          },
        ];
      }

      const { data, interactionId } = await generateWithOmniVideo(
        prompt,
        { aspectRatio, resolution },
        imageParts,
        previousInteractionId
      );
      const savedPath = await saveVideo(data, "omni");

      return {
        content: [
          {
            type: "text",
            text: `[Video - Gemini Omni Flash]\n\n${previousInteractionId ? "Edited" : "Generated"} video for: "${prompt}"\n\nSettings: ${aspectRatio} | ${resolution}${imagePath ? " | image-to-video" : ""}\n\nSaved to:\n- ${savedPath}\n\nInteraction ID: ${interactionId}\n(Pass this as previousInteractionId to continue editing this video)`,
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
  console.error("Gemini MCP server running (v2.1.0)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
