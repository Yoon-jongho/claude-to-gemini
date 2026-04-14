# Gemini MCP 실전 활용 가이드

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [실전 워크플로우](#실전-워크플로우)
3. [유스케이스 1: 부사수 코드 리뷰](#유스케이스-1-부사수-코드-리뷰)
4. [유스케이스 2: 대규모 리팩토링](#유스케이스-2-대규모-리팩토링)
5. [유스케이스 3: 프로젝트 온보딩](#유스케이스-3-프로젝트-온보딩)
6. [유스케이스 4: 아키텍처 설계](#유스케이스-4-아키텍처-설계)
7. [유스케이스 5: AI 이미지 생성 (용도별 6개 도구)](#유스케이스-5-ai-이미지-생성-용도별-6개-도구)
8. [일일 루틴 예시](#일일-루틴-예시)
9. [팁과 트릭](#팁과-트릭)

---

## 프로젝트 개요

### 핵심 컨셉: Agent-to-Agent (A2A) 워크플로우

```
사용자 → Claude Code (메인) → Gemini (서브) → Claude Code (결과 정리)
```

**역할 분담:**
- **Claude Code**: 일반 코딩, 디버깅, 파일 생성/수정, 사용자 대화
- **Gemini 2.5**: 대규모 컨텍스트 분석, 전체 코드베이스 리뷰

### 언제 Gemini를 사용하나?

#### ✅ Gemini 사용 (500줄+ 또는 15개+ 파일)
- 전체 코드베이스 분석
- 대규모 코드 변경 리뷰
- 복잡한 아키텍처 설계
- 중복 코드 탐지
- 보안 취약점 스캔

#### ⏭️ Claude만 사용 (200줄 이하, 5개 이하 파일)
- 단일 파일 수정
- 간단한 버그 수정
- 작은 기능 추가
- 일반 질의응답

---

## 실전 워크플로우

### 기본 패턴

```bash
# 1단계: 로컬 파일 수집
"local-search-mcp로 /path/to/project에서 
최근 변경된 파일들 전부 가져와줘"

# 2단계: Gemini 분석 요청
"ask_gemini 도구 사용:

프로젝트명 - 코드 리뷰

기술 스택:
- ...

<파일 내용들>

다음 관점에서 분석:
1. ...
2. ...

우선순위별 분류:
🚨 Critical
⚠️ High
💡 Medium
📝 Low"

# 3단계: Claude가 결과 정리 및 액션 아이템 제시
```

---

## 유스케이스 1: 부사수 코드 리뷰

### 상황
- **담당자**: 박지승 (2년차 주니어)
- **프로젝트**: 인천공항 키오스크 (Vue 3 + Vite)
- **리뷰 주기**: 매일 아침 09:00-10:30
- **변경 규모**: 일일 평균 300-1000줄, 10-30개 파일

### 실제 프롬프트 (A2A 워크플로우)

```
Step 1: 변경 파일 수집
────────────────────
"local-search-mcp로 
/Users/yoonjongho/Desktop/YJH_folder/work/front-end/Kiosk_platform/packages/incheon 
에서 어제부터 변경된 파일들 가져와줘"

Step 2: Gemini 분석 (대규모일 경우)
────────────────────
"ask_gemini 도구 사용:

인천공항 키오스크 프로젝트 - 부사수 코드 리뷰
담당: 박지승 | 리뷰어: 윤종호

기술 스택:
- Vue 3 Composition API
- Pinia Store
- Vite 7
- TypeScript

[변경된 15개 파일 내용...]

Linear 이슈: LIN-XXX '결제 시스템 구현'

다음 관점에서 종합 분석:

1. 전체 구현 방향 평가
2. Linear 이슈 요구사항 충족도
3. Vue Composition API 올바른 사용
   - ref/reactive 적절성
   - computed 성능
   - lifecycle hooks
4. Pinia Store 패턴 일관성
5. API 에러 핸들링 완성도
6. 키오스크 UX 고려사항
   - 터치 인터페이스 (44px+ 버튼)
   - 큰 폰트
   - 타임아웃 처리
7. 보안 (결제/인증 정보 처리)
8. 성능 이슈 (불필요한 렌더링)
9. 코드 중복 및 리팩토링 기회

우선순위별 분류:
🚨 Critical (즉시 수정 필요)
⚠️ High (이번 주 내 수정)
💡 Medium (리팩토링 권장)
📝 Low (개선 제안)"

Step 3: Linear 이슈 코멘트 (Claude)
────────────────────
"linear MCP로 LIN-XXX 이슈에 코멘트:

제목: 코드 리뷰 완료 - 수정 필요사항

안녕하세요, 지승님!
어제 작업하신 결제 시스템 구현 리뷰 완료했습니다.

✅ 잘하신 점
1. Composition API 깔끔하게 사용
2. Pinia Store 구조 명확
3. ...

🔧 수정 요청사항
🚨 Critical
1. 보안: src/api/payment.js:45
   - 문제: 카드 정보 console.log 노출
   - 수정: 민감 정보 로깅 제거
   
⚠️ High
2. 성능: src/components/ProductList.vue:78
   - v-for 내부 computed 호출 → 외부로 이동
   
💡 Medium
3. UX: 터치 버튼 44px+ 권장 (현재 32px)

수정 완료하시면 알려주세요!
리뷰어: 윤종호"
```

### 실제 결과

**Before Gemini**: 리뷰 시간 45-60분
**After Gemini**: 리뷰 시간 20-30분 (50% 단축)

**개선 효과:**
- ✅ 전체 맥락 파악 시간 단축
- ✅ 놓치는 이슈 감소 (보안, 성능)
- ✅ 일관된 리뷰 품질
- ✅ 부사수 성장 가속화

---

## 유스케이스 2: 대규모 리팩토링

### 상황
- **프로젝트**: ino-admin-web (Angular 20)
- **작업**: BehaviorSubject → Signals 마이그레이션
- **범위**: 25개 컴포넌트, 8개 서비스, 1200줄

### 실제 프롬프트

```
Step 1: 현재 코드 수집
────────────────────
"local-search-mcp로 
/Users/yoonjongho/Desktop/YJH_folder/work/front-end/ino-admin-web/src/app
에서 'BehaviorSubject'를 포함한 파일들 찾아줘"

Step 2: Gemini 분석
────────────────────
"ask_gemini 도구 사용:

ino-admin-web - BehaviorSubject → Signals 마이그레이션 분석

기술 스택:
- Angular 20 Standalone
- 현재: BehaviorSubject (RxJS)
- 목표: Signals (Angular 20)

[25개 파일 내용...]

다음 분석 요청:

1. 마이그레이션 전략
   - 단계별 계획 (서비스 우선 vs 컴포넌트 우선)
   - 의존성 순서 (어떤 파일부터?)
   
2. 각 파일별 변환 계획
   - BehaviorSubject → signal
   - combineLatest → computed
   - 구독 패턴 → effect
   
3. 주의사항
   - 타입 안정성
   - 성능 영향
   - 테스트 필요 영역
   
4. 예상 소요 시간 및 리스크"

Step 3: 단계별 실행 (Claude)
────────────────────
"Gemini 분석 결과를 바탕으로 
가장 우선순위 높은 서비스 3개부터 마이그레이션 시작할게"
```

### 실제 결과

**Gemini 제안:**
```
1단계 (1-2일): Core Services
- auth.service.ts
- layout-state.service.ts
- toast.service.ts

2단계 (2-3일): Feature Services
- companies.service.ts
- admin-users.service.ts

3단계 (2-3일): Components
- 의존성 순서대로 25개 컴포넌트
```

**효과:**
- ✅ 마이그레이션 실패 0건
- ✅ 예상 시간 정확도 95%
- ✅ 리스크 사전 파악

---

## 유스케이스 3: 프로젝트 온보딩

### 상황
- **신규 프로젝트**: urwi-app (Nuxt 3)
- **상황**: 인수인계 없이 코드만 받음
- **목표**: 1시간 내 핵심 파악

### 실제 프롬프트

```
"gemini_analyze_codebase 도구 사용:

directory: /Users/yoonjongho/Desktop/YJH_folder/work/front-end/urwi-app
focus: architecture

다음 정보 추출:

1. 프로젝트 구조
   - 디렉토리 역할
   - 레이어 분리 (pages/components/composables)
   
2. 핵심 기능
   - 주요 페이지 3-5개
   - 주요 API 엔드포인트
   
3. 기술 스택 및 의존성
   - 상태 관리 방식
   - 렌더링 전략 (SSR/CSR)
   
4. 코드 품질
   - 일관성
   - 베스트 프랙티스 준수도
   
5. 잠재적 이슈
   - 기술 부채
   - 개선 기회
   
6. Quick Start 가이드
   - 로컬 실행 방법
   - 개발 환경 설정"
```

### 실제 결과

**Gemini 응답 (요약):**
```markdown
## 프로젝트 개요
- Nuxt 3 + Pinia (Wiki 플랫폼)
- SSR/CSR 혼합 전략
- 동적 라우팅: [wikiId]/feed

## 핵심 기능
1. 위키 생성/편집
2. 피드 시스템 (CSR)
3. 사용자 인증 (JWT)

## 잠재적 이슈
⚠️ /pages/[wikiId]/feed - N+1 쿼리 가능성
💡 stores/wiki.ts - 캐싱 전략 부재

## Quick Start
$ npm install
$ npm run dev  # http://localhost:3000
```

**효과:**
- ✅ 온보딩 시간: 4시간 → 1시간
- ✅ 핵심 파악 정확도 높음
- ✅ 개선 포인트 즉시 인지

---

## 유스케이스 4: 아키텍처 설계

### 상황
- **프로젝트**: Kiosk_platform (신규)
- **요구사항**: Monorepo + 멀티 리전 지원
- **제약**: 기존 Incheon 코드 재사용

### 실제 프롬프트

```
"ask_gemini 도구로 model을 'pro'로 설정:

키오스크 플랫폼 아키텍처 설계

요구사항:
1. Monorepo 구조 (PNPM Workspace)
2. 지역별 독립 배포 (AWS Amplify)
3. 공통 컴포넌트 라이브러리
4. 기존 인천 코드 마이그레이션

기술 스택:
- Vue 3 + Vite
- Pinia
- PNPM Workspace

설계 요청:
1. 디렉토리 구조
2. 패키지 분리 전략
   - packages/incheon
   - packages/dongseongro
   - packages/shared
3. 공통 로직 추출 방법
4. 독립 배포 전략 (Amplify 설정)
5. 개발 워크플로우
6. 마이그레이션 단계별 계획
7. 예상 이슈 및 해결 방안"
```

### 실제 결과

**Gemini 제안 (Pro 모델):**
```
packages/
├── incheon/
│   ├── src/
│   ├── amplify.yml
│   └── package.json (name: @kiosk/incheon)
├── dongseongro/
│   └── ... (동일 구조)
├── shared/
│   ├── components/
│   ├── composables/
│   └── utils/

# pnpm-workspace.yaml
packages:
  - 'packages/*'

# 공통 로직 추출
@kiosk/shared → ESM import로 사용

# 독립 배포
각 패키지마다 별도 Amplify App
```

**효과:**
- ✅ 설계 시간: 1주일 → 2일
- ✅ 아키텍처 견고성 향상
- ✅ 예상 문제 사전 방지

---

## 유스케이스 5: AI 이미지 생성 (용도별 6개 도구)

### 상황
- **프로젝트**: 키오스크 UI/UX 개선 + 마케팅
- **요구사항**: 용도에 맞는 최적 모델 자동 선택
- **도구 구성**: 6개 전문 도구 (로고, 삽화, 인포그래픽, 사진, 배너, 편집)

### 도구별 모델 매핑

| 도구 | 모델 | 비용 | 핵심 강점 |
|------|------|------|-----------|
| `generate_logo` | Nano Banana Pro | 유료 | 전문 에셋, 스케일러블 |
| `generate_illustration` | Nano Banana 2 | **무료** | 빠른 생성, 다양한 화풍 |
| `generate_infographic` | Nano Banana Pro | 유료 | 텍스트 렌더링, 사고 모드 |
| `generate_photo` | Imagen 4 | 유료 | 최고 사실적 품질, 4K |
| `generate_banner` | Nano Banana Pro | 유료 | 텍스트+그래픽, 플랫폼 프리셋 |
| `edit_image` | Nano Banana 2 | **무료** | 인터리브 편집, 요소 추가/삭제 |

---

### 시나리오 1: 브랜드 로고 제작 (`generate_logo`)

**상황**: 새 키오스크 브랜드 로고가 필요

```
Step 1: 스타일별 로고 탐색
────────────────────
"generate_logo 도구 사용:

prompt: A coffee cup combined with a kiosk screen shape
brandName: CafeKiosk
style: modern
colorScheme: navy blue and gold"

Step 2: 다른 스타일로 비교
────────────────────
"같은 로고를 style을 'minimal'로 변경해서 다시 생성해줘"

Step 3: 변형 확장
────────────────────
"2번이 좋아! 같은 컨셉으로
1. 앱 아이콘 버전 (심플하게)
2. 가로형 로고 (텍스트 옆에 아이콘)
두 가지 생성해줘"
```

**효과:**
- ⏱️ 생성 시간: 15-20초
- 🎯 전문 애셋 제작에 최적화된 Nano Banana Pro 자동 사용
- ✅ 용도: 브랜딩, 앱 아이콘, 명함, 간판

---

### 시나리오 2: 삽화/일러스트 제작 (`generate_illustration`)

**상황**: 키오스크 온보딩 화면에 들어갈 일러스트 필요

```
Step 1: 다양한 화풍 테스트 (무료)
────────────────────
"generate_illustration 도구 사용:

prompt: A friendly barista welcoming customers at a modern cafe
style: watercolor
mood: cheerful
aspectRatio: 16:9
numberOfImages: 4"

Step 2: 스타일 변경 비교
────────────────────
"같은 장면을 style을 'cartoon'으로 바꿔서 4개 더 생성해줘"

Step 3: 시리즈 제작
────────────────────
"watercolor 스타일로 확정!
키오스크 사용 단계별 일러스트 3개 생성:
1. 메뉴 선택하는 장면
2. 결제하는 장면
3. 음료 받는 장면"
```

**효과:**
- ⏱️ 생성 시간: 10초 이내
- 💰 비용: **무료** (Nano Banana 2)
- 🔄 무제한 반복 가능
- ✅ 용도: 프로토타입, 온보딩, 가이드, A/B 테스트

---

### 시나리오 3: 인포그래픽/다이어그램 제작 (`generate_infographic`)

**상황**: README, 발표 자료, 기술 문서에 다이어그램 필요

```
Step 1: 아키텍처 다이어그램
────────────────────
"generate_infographic 도구 사용:

prompt: Microservices architecture diagram showing
API Gateway, Auth Service, Order Service, Payment Service,
and PostgreSQL database connections
type: diagram
aspectRatio: 16:9"

Step 2: 플로우차트
────────────────────
"generate_infographic 도구 사용:

prompt: User checkout flow from cart review to payment
confirmation with decision points for coupon and membership
type: flowchart
aspectRatio: 1:2"

Step 3: 통계 인포그래픽
────────────────────
"generate_infographic 도구 사용:

prompt: Monthly kiosk usage statistics infographic
data: Orders: 12,500 / Peak hour: 12-1PM / Top menu: Americano 35%,
Latte 28%, Tea 15% / Avg transaction: $4.50
type: stats
aspectRatio: 1:4"
```

**효과:**
- 🧠 사고 모드로 복잡한 정보 구조 추론
- 📝 텍스트 렌더링 최적화 (읽기 쉬운 라벨)
- ✅ 용도: 기술 문서, 발표 자료, 팀 커뮤니케이션

---

### 시나리오 4: 고품질 사진 생성 (`generate_photo`)

**상황**: 키오스크 메뉴판에 들어갈 실제 음식 사진 필요

```
Step 1: 제품 사진 생성 (유료)
────────────────────
"generate_photo 도구 사용:

prompt: Professional food photography of a latte with beautiful
latte art, warm cafe lighting, shallow depth of field,
high resolution, commercial quality, appealing composition
style: studio
numberOfImages: 4"

Step 2: 다른 앵글/스타일
────────────────────
"같은 라떼를 style을 'cinematic'으로,
top-down view 구도로 생성해줘"
```

**효과:**
- ⏱️ 생성 시간: 10-15초
- 💰 비용: 유료 (Imagen 4)
- 📸 품질: 포토리얼리스틱 (최대 4K)
- 🔒 SynthID 워터마크 자동 포함
- ✅ 용도: 실제 배포, 메뉴판, 광고, 프린트

---

### 시나리오 5: 마케팅 배너/SNS 제작 (`generate_banner`)

**상황**: SNS 프로모션 이미지 급하게 필요

```
Step 1: Instagram 포스트
────────────────────
"generate_banner 도구 사용:

prompt: Bright modern cafe promotion with coffee beans
and warm colors, inviting atmosphere
text: Grand Opening 50% OFF
platform: instagram"

Step 2: Facebook 커버
────────────────────
"같은 컨셉으로 platform을 'facebook'으로 바꿔서
Facebook 커버 사이즈로 생성해줘"

Step 3: YouTube 썸네일
────────────────────
"generate_banner 도구 사용:

prompt: Eye-catching kiosk demo video thumbnail,
tech and coffee fusion concept
text: How Our Kiosk Works
platform: youtube"
```

**효과:**
- 📐 플랫폼별 최적 사이즈 자동 적용
- 📝 텍스트 + 그래픽 조합 최적화
- ✅ 용도: SNS 마케팅, 프로모션, 광고 배너

---

### 시나리오 6: 이미지 편집/수정 (`edit_image`)

**상황**: 기존 이미지를 수정해야 할 때

```
Step 1: 배경 요소 제거 (무료)
────────────────────
"edit_image 도구 사용:

prompt: Remove the background people and keep only the coffee cup
imagePath: ./generated_images/photo_001.png
action: remove"

Step 2: 요소 추가
────────────────────
"edit_image 도구 사용:

prompt: Add a small CafeKiosk logo watermark in the bottom right corner
imagePath: ./generated_images/photo_001_edited.png
action: add"

Step 3: 스타일 변환
────────────────────
"edit_image 도구 사용:

prompt: Convert this photo into a watercolor painting style
imagePath: ./generated_images/photo_001.png
action: style_transfer"
```

**효과:**
- 💰 비용: **무료** (Nano Banana 2)
- 🔄 대화형 반복 수정 가능
- ✅ 용도: 후보정, 배경 제거, 스타일 변환, 요소 추가/삭제

---

### 시나리오 7: 실전 워크플로우 (다중 도구 조합)

**전략**: 무료 도구로 탐색 → 전문 도구로 확정 → 편집으로 마무리

```
1단계: 컨셉 탐색 (generate_illustration - 무료)
────────────────────
"삽화 스타일로 키오스크 배경 이미지 10가지 테스트
- 미니멀 / 따뜻한 / 모던 / 자연"

2단계: 최종 사진 생성 (generate_photo - 유료)
────────────────────
"2번 컨셉이 좋네!
사실적 사진 스타일로 최종 배포용 생성"

3단계: 배너 제작 (generate_banner)
────────────────────
"완성된 이미지 컨셉으로
Instagram, Facebook 프로모션 배너 제작"

4단계: 후보정 (edit_image - 무료)
────────────────────
"배너에 프로모션 텍스트 위치 조정"
```

**비용 최적화:**
- 🟢 컨셉 탐색 10회: $0 (`generate_illustration` - 무료)
- 🔵 최종 사진 1회: 유료 (`generate_photo`)
- 🟡 배너 2회: 유료 (`generate_banner`)
- 🟢 후보정 3회: $0 (`edit_image` - 무료)

---

### 실전 팁

#### 1. 도구 선택 가이드

| 목적 | 도구 | 이유 |
|------|------|------|
| 브랜드 로고/아이콘 | `generate_logo` | 스케일러블, 전문 에셋 |
| 프로토타입/목업 | `generate_illustration` | 무료, 빠른 반복 |
| 기술 문서/발표 자료 | `generate_infographic` | 텍스트 렌더링, 정보 구조화 |
| 실제 배포/광고 사진 | `generate_photo` | 포토리얼리스틱, 4K |
| SNS/마케팅 배너 | `generate_banner` | 플랫폼별 프리셋 |
| 기존 이미지 수정 | `edit_image` | 무료, 요소 추가/삭제 |

#### 2. 프롬프트 작성 팁

**❌ 나쁜 예:**
```
"커피 이미지 만들어줘"
```

**✅ 좋은 예:**
```
"Professional food photography of espresso in white ceramic cup,
top-down view, marble table, natural window lighting,
high resolution, commercial quality, minimalist composition"
```

**핵심 요소:**
- 📸 스타일: "professional photography", "flat design", "line art"
- 🎨 색상: 구체적인 색상 명시
- 💡 조명: "warm lighting", "dramatic shadows"
- 📏 구도: "centered", "top-down view", "close-up"
- 🎯 용도: "for kiosk", "icon", "background"

#### 3. 비용 최적화 전략

```
무료 도구 최대 활용:
- generate_illustration: 컨셉 탐색, 프로토타입, 문서 삽화
- edit_image: 후보정, 배경 제거, 스타일 변환

유료 도구는 최종 결과물에만:
- generate_logo: 확정된 브랜드 로고
- generate_infographic: 최종 발표 자료
- generate_photo: 배포용 사진
- generate_banner: 실제 마케팅 배너

월 예상 비용:
- 무료 (illustration + edit): 무제한
- 유료 (logo + infographic + banner): Nano Banana Pro 사용량 기반
- 유료 (photo): Imagen 4 사용량 기반
```

---

## 일일 루틴 예시

### 아침 루틴 (09:00-10:30) - 코드 리뷰

```bash
# Terminal 1: Claude Code 시작
$ claude

# Claude 프롬프트
"오늘 아침 루틴: 부사수 코드 리뷰

1. git log 확인
2. 변경 규모 판단
3. Gemini 필요 시 A2A 워크플로우
4. Linear 이슈 코멘트"

# Claude가 자동으로:
# - git diff 확인
# - 파일 수/라인 수 카운트
# - 규모에 따라 Gemini 호출 여부 결정
# - 결과를 Linear에 코멘트
```

### 실제 시나리오 (큰 변경)

```
[Claude 판단]
변경: 18개 파일, 850줄
→ Gemini 사용 권장

[자동 실행]
1. local-search-mcp로 파일 수집
2. ask_gemini로 종합 분석
3. Linear 코멘트 작성
4. 우선순위 액션 아이템 정리

[결과]
⏱️ 소요 시간: 25분
✅ 발견 이슈: 8건 (Critical 2, High 3, Medium 3)
```

---

## 팁과 트릭

### 1. 효과적인 Gemini 프롬프트 작성

#### ❌ 나쁜 예
```
"이 코드 리뷰해줘"
```

#### ✅ 좋은 예
```
"ask_gemini 도구 사용:

프로젝트: {명확한 이름}
기술 스택: {구체적인 버전}

[파일 내용]

분석 관점:
1. {구체적인 항목}
2. {측정 가능한 기준}

출력 형식:
- 우선순위별 분류
- 구체적인 파일명:라인
- Before/After 코드 예시"
```

### 2. 모델 선택 기준

#### 텍스트/코드 생성

| 상황 | 모델 | 이유 |
|------|------|------|
| 일반 코드 리뷰 | Flash | 무료, 충분히 빠름 |
| 아키텍처 설계 | Pro (Gemini 3) | 복잡한 추론 필요 |
| 보안 분석 | Pro (Gemini 3) | 정확도 중요 |
| 중복 코드 탐지 | Flash | 패턴 매칭 중심 |

#### 이미지 생성

| 상황 | 도구 | 모델 | 이유 |
|------|------|------|------|
| 로고/아이콘 | `generate_logo` | Nano Banana Pro | 전문 에셋 제작 특화 |
| 프로토타입/삽화 | `generate_illustration` | Nano Banana 2 | 무료, 빠른 반복 |
| 기술 문서/다이어그램 | `generate_infographic` | Nano Banana Pro | 텍스트 렌더링 + 사고 모드 |
| 실제 배포/광고 사진 | `generate_photo` | Imagen 4 | 포토리얼리스틱, 4K |
| SNS/마케팅 배너 | `generate_banner` | Nano Banana Pro | 플랫폼 프리셋, 텍스트 조합 |
| 이미지 후보정 | `edit_image` | Nano Banana 2 | 무료, 대화형 편집 |

### 3. 변경 규모 자동 판단 스크립트

```bash
# .zshrc에 추가
function code_review_size() {
    local lines=$(git diff HEAD~5..HEAD --stat | tail -1 | awk '{print $4}')
    local files=$(git diff HEAD~5..HEAD --name-only | wc -l)
    
    echo "변경: ${files}개 파일, ${lines}줄"
    
    if [[ $files -gt 15 || $lines -gt 500 ]]; then
        echo "🔴 큰 변경 → Gemini 사용 권장"
    elif [[ $files -gt 5 || $lines -gt 200 ]]; then
        echo "🟡 중간 변경 → Claude 주의"
    else
        echo "🟢 작은 변경 → Claude만"
    fi
}
```

### 4. .clinerules와 연계

```markdown
# .clinerules 파일에 추가

## A2A 워크플로우 기준
- 🟢 작은: ~200줄, ~5파일 → Claude만
- 🟡 중간: 200-500줄, 5-15파일 → Claude 주의
- 🔴 큰: 500줄+ 또는 15+파일 → Gemini→Claude

## 큰 변경 프롬프트 템플릿
"""
ask_gemini 도구 사용:
{프로젝트명} - {작업명}
...
"""
```

### 5. 비용 최적화

#### 텍스트/코드 생성

```bash
# Flash (무료) 우선 사용
ask_gemini → 기본적으로 Flash

# Pro는 꼭 필요할 때만
- 아키텍처 설계
- 중요한 의사결정
- 복잡한 추론

# 월 예상 비용
Flash: $0 (무료)
Pro (Gemini 3): 주 1-2회 사용 → 월 $5-10
```

#### 이미지 생성

```bash
# 3단계 전략 (탐색 → 제작 → 후보정)
1. generate_illustration로 컨셉 탐색 (무료)
2. 용도별 전문 도구로 최종 제작 (logo/infographic/photo/banner)
3. edit_image로 후보정 (무료)

# 월 예상 비용
무료 도구 (illustration + edit): 무제한
유료 도구 (logo + infographic + banner): Nano Banana Pro 사용량 기반
유료 도구 (photo): Imagen 4 사용량 기반

# 총 절감 효과
디자이너 외주 대비: 월 $150-300 절감
```

### 6. 일반적인 실수

#### ❌ 너무 작은 작업에 Gemini 사용
```
단일 파일 10줄 수정 → Gemini 호출
(불필요한 오버헤드)
```

#### ✅ 적절한 규모에만 사용
```
15개 파일, 800줄 변경 → Gemini 호출
(명확한 가치)
```

#### ❌ 컨텍스트 없는 질문
```
"이 코드 분석해줘" (어떤 관점으로?)
```

#### ✅ 명확한 컨텍스트 제공
```
"기술 스택: Vue 3
관점: 성능 최적화
특히: computed vs watch 사용"
```

---

## 실전 체크리스트

### 매일 아침 (코드 리뷰)
- [ ] `git log --since="yesterday"` 확인
- [ ] 변경 규모 판단 (파일 수, 라인 수)
- [ ] 규모에 따라 전략 선택
- [ ] Gemini 사용 시 A2A 워크플로우
- [ ] Linear 이슈 코멘트 작성

### 새 프로젝트 시작
- [ ] `gemini_analyze_codebase` 로 구조 파악
- [ ] 핵심 파일 3-5개 확인
- [ ] 기술 부채 리스트 작성
- [ ] `.clinerules` 작성

### 대규모 리팩토링
- [ ] Gemini로 마이그레이션 계획 수립
- [ ] 단계별 실행 순서 확정
- [ ] 각 단계마다 테스트 계획
- [ ] 롤백 전략 준비

### 아키텍처 설계
- [ ] Pro 모델 사용 고려
- [ ] 요구사항 명확히 정리
- [ ] 제약사항 명시
- [ ] 여러 대안 비교 요청

---

## 마치며

### 핵심 원칙

1. **적재적소**: 작은 작업은 Claude만, 큰 작업은 Gemini
2. **명확한 컨텍스트**: 프로젝트 정보, 기술 스택, 분석 관점
3. **A2A 워크플로우**: Claude → Gemini → Claude
4. **비용 최적화**: Flash 우선, Pro는 필요시만

### 기대 효과

- ⏱️ **시간 절약**: 코드 리뷰 50% 단축
- 🎯 **품질 향상**: 놓치는 이슈 감소
- 📈 **생산성**: 대규모 작업 빠른 착수
- 🧠 **학습**: AI의 인사이트 습득

### 다음 단계

1. 자신의 프로젝트에 적용
2. `.clinerules`에 A2A 기준 추가
3. 일일/주간 루틴 확립
4. 팀에 공유 (효과 입증 후)

---

**Happy Coding with Claude & Gemini! 🚀**
