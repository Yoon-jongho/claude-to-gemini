import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini API 초기화
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// MCP 서버 생성
const server = new Server(
  {
    name: "gemini-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 사용 가능한 도구 목록
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
                "Model to use: 'flash' (default, free, fast) or 'pro' (3 Pro, latest model, better quality, paid)",
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
              description: "The entire codebase or multiple files concatenated",
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
    ],
  };
});

// 도구 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "ask_gemini") {
      const { prompt, context, model = "flash" } = args;

      // 모델 선택
      const modelName =
        model === "pro"
          ? "gemini-3-pro-preview-11-2025" // Gemini 3 Pro (최신 모델, 2025년 11월 출시)
          : "gemini-2.5-flash"; // 2.5 Flash (무료)

      const geminiModel = genAI.getGenerativeModel({ model: modelName });

      // 프롬프트 구성
      const fullPrompt = context
        ? `Context/Codebase:\n\`\`\`\n${context}\n\`\`\`\n\nTask: ${prompt}`
        : prompt;

      // Gemini 호출
      const result = await geminiModel.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      return {
        content: [
          {
            type: "text",
            text: `[Gemini ${
              model === "pro" ? "3.0 Pro" : "2.5 Flash"
            }]\n\n${text}`,
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

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error calling Gemini: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Gemini MCP server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
