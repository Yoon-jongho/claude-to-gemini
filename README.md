# Claude-to-Gemini MCP Server

Claude Code에서 Google Gemini를 MCP(Model Context Protocol) 서버로 사용하는 Agent-to-Agent 통합 프로젝트

## 프로젝트 목적

- **Claude Code**: 메인 AI (일반 코딩, 디버깅, 파일 생성/수정)
- **Gemini**: 서브 AI (대규모 컨텍스트 분석, 코드베이스 리뷰, 이미지 생성/분석, 영상 생성)

## 주요 기능

### 텍스트/코드 도구

#### 1. `ask_gemini` - 텍스트/코드 생성

- **용도**: 일반 Gemini 호출, 큰 컨텍스트 분석
- **모델 선택**:
  - `flash` (기본): Gemini 3.5 Flash - 빠르고 효율적
  - `pro`: Gemini 3.1 Pro - 고성능
  - `argon`: **Gemini 4 Argon** - 최신 플래그십, 최고 추론 성능
- **컨텍스트**: 최대 1M 토큰

#### 2. `gemini_analyze_codebase` - 코드베이스 분석

- **용도**: 전체 코드베이스 전문 분석
- **분석 타입**: `architecture` | `duplications` | `security` | `performance` | `general`

### 이미지 생성 도구

> **과금 안내**: 모든 이미지 모델은 생성할 때마다 과금됩니다. 무료 등급은 없습니다. [Google AI 가격 페이지](https://ai.google.dev/gemini-api/docs/pricing)를 확인하세요.

#### 3. `generate_logo` - 로고/아이콘 생성

- **모델**: Nano Banana Pro (`gemini-3-pro-image`)
- **특징**: 전문 텍스트 렌더링, 1:1 비율, 최대 4K
- **파라미터**: `prompt`, `brandName`, `style`, `colorScheme`, `imageSize`, `thinkingLevel`, `searchGrounding`

#### 4. `generate_illustration` - 삽화/아트워크 생성

- **모델**: Nano Banana 2.1 (`gemini-nano-banana-2.1`) 또는 Lite (`gemini-3.1-flash-lite-image`)
- **특징**: 최대 4K, thinking 모드, Google Search/Image Search grounding
- **파라미터**: `prompt`, `style`, `mood`, `model`(nb2.1/lite), `aspectRatio`, `numberOfImages`, `imageSize`, `thinkingLevel`, `searchGrounding`, `rawPrompt`
- **rawPrompt**: `true`로 설정 시 시스템 프롬프트(스타일 지시문)를 끄고 사용자 프롬프트만 전달. 픽셀아트 등 단순한 스타일에 유용.

#### 5. `generate_infographic` - 인포그래픽/다이어그램 생성

- **모델**: Nano Banana Pro (`gemini-3-pro-image`)
- **특징**: 텍스트 렌더링 최적화, Google Search grounding으로 실시간 데이터 시각화
- **파라미터**: `prompt`, `data`, `type`, `aspectRatio`, `imageSize`, `thinkingLevel`, `searchGrounding`

#### 6. `generate_photo` - 사실적 사진 생성

- **모델**: Nano Banana Pro (`gemini-3-pro-image`) — Imagen 4 지원 종료로 대체
- **특징**: 포토리얼리스틱, 최대 4K, SynthID 워터마크
- **파라미터**: `prompt`, `style`, `numberOfImages`, `aspectRatio`, `imageSize`, `thinkingLevel`, `searchGrounding`

#### 7. `generate_banner` - 마케팅 배너/SNS 이미지 생성

- **모델**: Nano Banana Pro (`gemini-3-pro-image`)
- **특징**: 플랫폼별 최적 사이즈 프리셋, 텍스트+그래픽 조합
- **파라미터**: `prompt`, `text`, `platform`, `aspectRatio`, `imageSize`, `thinkingLevel`, `searchGrounding`

#### 8. `edit_image` - 이미지 편집/수정 (멀티턴)

- **모델**: Nano Banana 2.1 또는 Pro (선택 가능)
- **특징**:
  - 멀티턴 편집 (`previousInteractionId`로 이어서 수정)
  - 최대 14개 레퍼런스 이미지 (오브젝트/캐릭터/스타일)
  - Google Search + Image Search grounding
  - 최대 4K 해상도
- **파라미터**: `prompt`, `imagePath`, `imagePaths`, `action`, `model`(nb2.1/pro), `previousInteractionId`, `aspectRatio`, `imageSize`, `thinkingLevel`, `searchGrounding`

### 이미지 분석 도구

#### 9. `analyze_image` - 이미지 분석/이해

- **모델**: Gemini 3.8 Flash (`gemini-3.8-flash`)
- **모드**:
  - `caption` (기본): 캡셔닝, 시각 QA, 다중 이미지 비교
  - `detect`: 객체 감지 + 바운딩 박스 (0-1000 정규화)
  - `segment`: 이미지 세그멘테이션 + 폴리곤 마스크
- **지원 포맷**: PNG, JPEG, WebP, HEIC, HEIF (인라인 20MB 제한)

### 영상 생성 도구

#### 10. `generate_video` - Veo 3.1 영상 생성

- **모델**: `veo-3.1` (기본) | `veo-3.1-fast` | `veo-3.1-lite`
- **특징**:
  - 네이티브 오디오 (대사, 효과음, 앰비언트)
  - Image-to-video, 시작+끝 프레임 보간
  - 최대 3개 레퍼런스 이미지
  - 720p / 1080p / 4K (1080p+는 8초 필수)
- **파라미터**: `prompt`, `model`, `aspectRatio`, `resolution`, `durationSeconds`, `imagePath`, `lastFramePath`, `referenceImagePaths`, `personGeneration`

#### 11. `generate_video_omni` - Gemini Omni Flash 영상 생성

- **모델**: `gemini-omni-1.1-flash`
- **특징**:
  - 대화형 멀티턴 편집/확장
  - 비디오 확장 (`task: "extend"`)
  - 캐릭터/오브젝트 레퍼런스 이미지
  - 시작+끝 프레임 보간
  - 360p ~ 4K (720p 이상 업스케일)
- **파라미터**: `prompt`, `aspectRatio`, `resolution`, `imagePath`, `lastFramePath`, `referenceImagePaths`, `previousInteractionId`, `task`

## 기술 스택

- **Runtime**: Node.js 18+
- **MCP SDK**: @modelcontextprotocol/sdk
- **AI SDK**: @google/genai (Interactions API)
- **IDE**: Claude Code (CLI + VSCode 확장)

## 설치 방법

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
- `/ABSOLUTE_PATH/`를 실제 프로젝트 경로로 교체

### 5. 확인

```bash
claude mcp list
```

## 모델 비교

### 텍스트/코드 모델

| 모델 | 컨텍스트 | 속도 | 추천 용도 |
| --- | --- | --- | --- |
| Gemini 3.5 Flash | 1M 토큰 | 빠름 | 일반 분석, 대부분의 작업 |
| Gemini 3.1 Pro | 1M 토큰 | 빠름 | 복잡한 추론 |
| **Gemini 4 Argon** | 1M 토큰 | 보통 | 최고 성능, 어려운 수학/과학/코딩 |

### 이미지 생성 모델

| 모델 | 도구 | 해상도 | 특징 |
| --- | --- | --- | --- |
| Nano Banana Pro (`gemini-3-pro-image`) | logo, infographic, banner, photo | 1K-4K | 최고 텍스트 렌더링, 스타일 레퍼런스 |
| Nano Banana 2.1 (`gemini-nano-banana-2.1`) | illustration, edit_image | 1K-4K | 범용, 멀티턴 편집, 14개 레퍼런스 |
| Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`) | illustration (lite) | 1K | 최고 속도, 저비용 |

## 보안 주의사항

### API 키 보호

**절대 금지**: GitHub에 API 키 업로드, 코드에 하드코딩, 공개 장소에 공유

**권장**: 환경변수 관리, `.gitignore`에 `.env` 포함, 유출 시 즉시 재발급

### .gitignore 필수 내용

```
node_modules/
.claude.json
.env
*.key
generated_images/
generated_videos/
```

## 참고 자료

- [MCP 공식 문서](https://modelcontextprotocol.io)
- [Gemini API 문서](https://ai.google.dev/docs)
- [Gemini 이미지 생성 가이드](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini 가격 페이지](https://ai.google.dev/gemini-api/docs/pricing)
- [Claude Code 문서](https://docs.claude.com/en/docs/claude-code)

## 라이선스

MIT License

---

**Made with Claude Code + Gemini**
