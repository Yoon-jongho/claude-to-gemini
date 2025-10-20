# Claude-to-Gemini MCP Server

Claude Code에서 Google Gemini를 MCP(Model Context Protocol) 서버로 사용하는 Agent-to-Agent 통합 프로젝트

## 🎯 프로젝트 목적

- **Claude Code**: 메인 AI (일반 코딩, 디버깅, 파일 생성/수정)
- **Gemini 2.5**: 서브 AI (대규모 컨텍스트 분석, 전체 코드베이스 리뷰)

## ✨ 주요 기능

### 1. `ask_gemini`

- **용도**: 일반 Gemini 호출, 큰 컨텍스트 분석
- **모델 선택**:
  - `flash` (기본): Gemini 2.5 Flash - 무료, 빠름
  - `pro`: Gemini 2.5 Pro - 유료, 최고 성능
- **컨텍스트**: 최대 1M 토큰

### 2. `gemini_analyze_codebase`

- **용도**: 전체 코드베이스 전문 분석
- **분석 타입**:
  - `architecture`: 아키텍처 패턴 분석
  - `duplications`: 중복 코드 탐지
  - `security`: 보안 취약점 검사
  - `performance`: 성능 최적화 기회
  - `general`: 종합 분석

## 🛠 기술 스택

- **Runtime**: Node.js 18+
- **MCP SDK**: @modelcontextprotocol/sdk
- **AI API**: Google Gemini API (@google/generative-ai)
- **IDE**: Claude Code (CLI + VSCode 확장)

## 📦 설치 방법

### 1. 사전 준비

- Node.js 18 이상 설치
- Claude Pro/Max 플랜 구독
- Google Gemini API 키 발급 ([ai.google.dev](https://ai.google.dev))

### 2. 프로젝트 클론

```bash
git clone https://github.com/YOUR_USERNAME/claude-to-gemini.git
cd claude-to-gemini
```

### 3. 의존성 설치

```bash
npm install
```

### 4. MCP 서버 등록

```bash
claude mcp add gemini \
  --env GEMINI_API_KEY=YOUR_API_KEY_HERE \
  -- node /ABSOLUTE_PATH/claude-to-gemini/index.js
```

**주의**:

- `YOUR_API_KEY_HERE`를 실제 Gemini API 키로 교체
- `/ABSOLUTE_PATH/`를 실제 프로젝트 경로로 교체 (예: `/Users/username/projects/claude-to-gemini/index.js`)

### 5. 확인

```bash
claude mcp list
```

출력 예시:

```
gemini - node /Users/username/projects/claude-to-gemini/index.js
```

## 🚀 사용 방법

### Claude Code 시작

```bash
claude
```

### 기본 사용 (Flash 모델, 무료)

```
ask_gemini 도구를 사용해서 "이 프로젝트 전체 구조를 분석해줘" 물어봐줘
```

### Pro 모델 사용 (유료, 고성능)

```
ask_gemini 도구를 사용해서 model을 "pro"로 설정하고 "복잡한 아키텍처 설계해줘" 물어봐줘
```

### 코드베이스 분석

```
gemini_analyze_codebase 도구로 보안 취약점을 찾아줘
```

## 💡 사용 시나리오

### 시나리오 1: 새 프로젝트 아키텍처 설계

```
ask_gemini 도구로 React + Express + PostgreSQL
전자상거래 앱의 전체 아키텍처를 설계해줘
```

### 시나리오 2: 레거시 코드 분석

```
gemini_analyze_codebase 도구로
focus를 'duplications'로 설정해서 중복 코드를 찾아줘
```

### 시나리오 3: 대규모 리팩토링

```
ask_gemini 도구로 이 프로젝트 전체를 읽고
모던한 아키텍처로 마이그레이션 계획을 세워줘
```

## 📚 실전 가이드

**실무에서 어떻게 활용하나요?**

더 자세한 실전 활용법은 [**📖 실전 활용 가이드 (USECASES.md)**](./USECASES.md)를 참고하세요!

**주요 내용:**
- 🔍 부사수 코드 리뷰 (매일 아침 루틴)
- 🏗️ 대규모 리팩토링 (1200줄 마이그레이션)
- 🚀 프로젝트 온보딩 (1시간 내 핵심 파악)
- 🎨 아키텍처 설계 (Monorepo 구조)
- 💡 팁과 트릭 (비용 최적화, 모델 선택)

## 📊 모델 비교

| 모델             | 컨텍스트 | 비용 | 속도 | 추천 용도                |
| ---------------- | -------- | ---- | ---- | ------------------------ |
| Gemini 2.5 Flash | 1M 토큰  | 무료 | 빠름 | 일반 분석, 대부분의 작업 |
| Gemini 2.5 Pro   | 1M 토큰  | 유료 | 보통 | 복잡한 추론, 중요한 설계 |

## ⚠️ 보안 주의사항

### API 키 보호

**절대 금지**:

- ❌ GitHub에 API 키 업로드
- ❌ 코드에 API 키 하드코딩
- ❌ 공개 장소에 API 키 공유

**권장 사항**:

- ✅ 환경변수로만 관리
- ✅ `.gitignore`에 `.claude.json` 포함
- ✅ API 키 유출 시 즉시 재발급

### .gitignore 필수 내용

```
node_modules/
.claude.json
.env
*.key
```

## 🤝 기여 방법

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조

## 🔗 참고 자료

- [MCP 공식 문서](https://modelcontextprotocol.io)
- [Gemini API 문서](https://ai.google.dev/docs)
- [Claude Code 문서](https://docs.claude.com/en/docs/claude-code)

## 📧 문의

프로젝트 관련 문의: [GitHub Issues](https://github.com/YOUR_USERNAME/claude-to-gemini/issues)

---

**Made with ❤️ by [Your Name]**
