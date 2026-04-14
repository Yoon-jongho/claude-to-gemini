# Claude-to-Gemini MCP Server

Claude Code에서 Google Gemini를 MCP(Model Context Protocol) 서버로 사용하는 Agent-to-Agent 통합 프로젝트

## 🎯 프로젝트 목적

- **Claude Code**: 메인 AI (일반 코딩, 디버깅, 파일 생성/수정)
- **Gemini**: 서브 AI (대규모 컨텍스트 분석, 코드베이스 리뷰, 용도별 이미지 생성 6종)

## ✨ 주요 기능

### 1. `ask_gemini` - 텍스트/코드 생성

- **용도**: 일반 Gemini 호출, 큰 컨텍스트 분석
- **모델 선택**:
  - `flash` (기본): Gemini 2.5 Flash - 무료, 빠름
  - `pro`: **Gemini 3.1 Pro** - 최신 모델 (2026.02 출시), 최고 성능
- **컨텍스트**: 최대 1M 토큰

### 2. `gemini_analyze_codebase` - 코드베이스 분석

- **용도**: 전체 코드베이스 전문 분석
- **분석 타입**:
  - `architecture`: 아키텍처 패턴 분석
  - `duplications`: 중복 코드 탐지
  - `security`: 보안 취약점 검사
  - `performance`: 성능 최적화 기회
  - `general`: 종합 분석

### 3. `generate_logo` - 로고/아이콘 생성

- **용도**: 로고, 아이콘, 브랜딩 에셋 제작
- **모델**: Nano Banana Pro (`gemini-3-pro-image-preview`) - 전문적 애셋 제작 특화
- **파라미터**:
  - `prompt`: 로고 설명 (영문)
  - `brandName`: 포함할 브랜드/텍스트명 (선택)
  - `style`: `minimal` | `modern` | `vintage` | `playful` | `corporate`
  - `colorScheme`: 색상 계열 (선택)
- **특징**: 심플하고 스케일러블한 디자인, 1:1 비율 기본

### 4. `generate_illustration` - 삽화/아트워크 생성

- **용도**: 삽화, 아트워크, 캐릭터, 컨셉아트
- **모델**: Nano Banana 2 (`gemini-3.1-flash-image-preview`) - 빠른 생성, **무료**
- **파라미터**:
  - `prompt`: 삽화 설명 (영문)
  - `style`: `watercolor` | `cartoon` | `vector` | `oil_painting` | `sketch` | `anime` | `pixel_art`
  - `mood`: `cheerful` | `dark` | `calm` | `dramatic` (선택)
  - `aspectRatio`: `1:1` | `16:9` | `9:16` | `4:3` | `3:4`
  - `numberOfImages`: 생성 개수 (1-4)

### 5. `generate_infographic` - 인포그래픽/다이어그램 생성

- **용도**: 인포그래픽, 다이어그램, 플로우차트, 타임라인
- **모델**: Nano Banana Pro (`gemini-3-pro-image-preview`) - 사고 모드 + 텍스트 렌더링 최적화
- **파라미터**:
  - `prompt`: 인포그래픽 주제/내용 (영문)
  - `data`: 시각화할 데이터/정보 (선택)
  - `type`: `infographic` | `diagram` | `flowchart` | `timeline` | `comparison` | `stats`
  - `aspectRatio`: `1:2` (기본) | `1:4` | `1:1` | `16:9`
- **특징**: 읽기 쉬운 텍스트 렌더링, 세로 긴 레이아웃 지원

### 6. `generate_photo` - 사실적 사진 생성

- **용도**: 포토리얼리스틱 이미지, 제품 목업, 광고 사진
- **모델**: Imagen 4 (`imagen-4.0-generate-001`) - 최고 사실적 품질, **유료**
- **파라미터**:
  - `prompt`: 사진 설명 (영문)
  - `style`: `natural` | `studio` | `cinematic` | `aerial` | `macro`
  - `numberOfImages`: 생성 개수 (1-4)
  - `aspectRatio`: `1:1` | `16:9` | `9:16` | `4:3` | `3:4`
- **특징**: 최대 4K 해상도, SynthID 워터마크 자동 포함

### 7. `generate_banner` - 마케팅 배너/SNS 이미지 생성

- **용도**: 마케팅 배너, SNS 이미지, 썸네일, 포스터
- **모델**: Nano Banana Pro (`gemini-3-pro-image-preview`) - 텍스트 + 그래픽 조합
- **파라미터**:
  - `prompt`: 배너 설명 (영문)
  - `text`: 배너에 포함할 텍스트 (선택)
  - `platform`: `facebook` | `instagram` | `twitter` | `youtube` | `linkedin` | `web`
  - `aspectRatio`: 플랫폼별 자동 설정
- **특징**: 플랫폼별 최적 사이즈 프리셋 제공

### 8. `edit_image` - 이미지 편집/수정

- **용도**: 기존 이미지에서 요소 추가/삭제/수정
- **모델**: Nano Banana 2 (`gemini-3.1-flash-image-preview`) - **무료**
- **파라미터**:
  - `prompt`: 편집 지시사항 (영문)
  - `imagePath`: 편집할 이미지 파일 경로
  - `action`: `modify` | `add` | `remove` | `style_transfer` | `enhance`
- **특징**: 인터리브 편집, 멀티턴 대화형 수정 지원

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

### 로고 생성

```
generate_logo 도구로 brandName을 "CafeKiosk"로, style을 "modern"으로 설정하고
"A minimalist coffee cup logo with geometric shapes" 로고 만들어줘
```

### 삽화 생성 (무료)

```
generate_illustration 도구로 style을 "watercolor"로 설정하고
"A cozy cafe interior with warm lighting" 삽화 생성해줘
```

### 인포그래픽 생성

```
generate_infographic 도구로 type을 "flowchart"로 설정하고
"User authentication flow: login, verify, 2FA, dashboard" 다이어그램 만들어줘
```

### 사실적 사진 생성 (유료 - Imagen 4)

```
generate_photo 도구로 style을 "studio"로, numberOfImages를 4로 설정하고
"Professional food photography of a latte with beautiful latte art" 이미지 4개 생성해줘
```

### 마케팅 배너 생성

```
generate_banner 도구로 platform을 "instagram"으로 설정하고
text를 "Grand Opening 50% OFF"로
"Bright modern cafe promotion banner with coffee beans" 배너 만들어줘
```

### 이미지 편집 (무료)

```
edit_image 도구로 action을 "remove"로, imagePath를 "./photo.png"으로 설정하고
"Remove the background person and keep only the coffee cup" 편집해줘
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
- 🖼️ 용도별 이미지 생성 (로고, 삽화, 인포그래픽, 사진, 배너, 편집)
- 💡 팁과 트릭 (비용 최적화, 모델 선택)

## 📊 모델 비교

### 텍스트/코드 생성 모델

| 모델             | 컨텍스트 | 비용 | 속도 | 추천 용도                |
| ---------------- | -------- | ---- | ---- | ------------------------ |
| Gemini 2.5 Flash | 1M 토큰  | 무료 | 빠름 | 일반 분석, 대부분의 작업 |
| **Gemini 3.1 Pro** | 1M 토큰  | 유료 | 빠름 | 최고 성능, 복잡한 추론   |

### 이미지 생성 모델

| 모델 | 도구 | 용도 | 비용 | 특징 |
| --- | --- | --- | --- | --- |
| Nano Banana Pro (`gemini-3-pro-image-preview`) | `generate_logo`, `generate_infographic`, `generate_banner` | 로고, 인포그래픽, 배너 | 유료 | 전문 애셋 제작, 텍스트 렌더링, 사고 모드 |
| Nano Banana 2 (`gemini-3.1-flash-image-preview`) | `generate_illustration`, `edit_image` | 삽화, 이미지 편집 | 무료 | 빠른 생성, 대화형 편집, 다양한 화풍 |
| Imagen 4 (`imagen-4.0-generate-001`) | `generate_photo` | 사실적 사진, 제품 목업 | 유료 | 최대 4K, 포토리얼리스틱, SynthID 포함 |

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
