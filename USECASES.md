# Gemini MCP 실전 활용 가이드

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [실전 워크플로우](#실전-워크플로우)
3. [유스케이스 1: 부사수 코드 리뷰](#유스케이스-1-부사수-코드-리뷰)
4. [유스케이스 2: 대규모 리팩토링](#유스케이스-2-대규모-리팩토링)
5. [유스케이스 3: 프로젝트 온보딩](#유스케이스-3-프로젝트-온보딩)
6. [유스케이스 4: 아키텍처 설계](#유스케이스-4-아키텍처-설계)
7. [유스케이스 5: AI 이미지 생성](#유스케이스-5-ai-이미지-생성)
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

## 유스케이스 5: AI 이미지 생성

### 상황
- **프로젝트**: 키오스크 UI/UX 개선
- **요구사항**:
  - 프로토타입 이미지 생성 (무료)
  - 최종 배포용 고품질 이미지 (유료)
- **작업**: 아이콘, 배경, 일러스트 제작

### 시나리오 1: 빠른 프로토타입 (Nano Banana 🍌)

**용도**: 디자인 아이디어 테스트, 목업 제작, 빠른 반복

```
Step 1: 초안 생성 (무료)
────────────────────
"generate_image_gemini 도구 사용:

prompt: A minimalist icon of a coffee cup for a kiosk interface,
simple geometric shapes, flat design, navy blue and white colors,
clean lines, suitable for touch screen

numberOfImages: 4"

Step 2: 반복 개선 (대화형)
────────────────────
"앞에서 생성한 이미지 중 3번째가 마음에 드는데,
좀 더 둥근 느낌으로 다시 생성해줘"

Step 3: 다양한 스타일 테스트
────────────────────
"같은 커피 아이콘을
1. 라인 아트 스타일
2. 3D 스타일
3. 손그림 스타일
로 각각 생성해줘"
```

**실제 결과:**
- ⏱️ 생성 시간: 즉시 (10초 이내)
- 💰 비용: **무료** (토큰 기반)
- 🔄 반복: 무제한 (대화형 편집)
- ✅ 용도: 프로토타입, A/B 테스트

### 시나리오 2: 최종 배포용 (Imagen 3)

**용도**: 실제 제품 배포, 마케팅 자료, 고품질 출력

```
Step 1: 최종 이미지 생성 (유료)
────────────────────
"generate_image_imagen 도구 사용:

prompt: Professional food photography of a latte with beautiful
latte art, warm cafe lighting, shallow depth of field,
high resolution, commercial quality, appealing composition

numberOfImages: 4"

Step 2: 베스트 선택
────────────────────
"4개 중 가장 좋은 걸로 고해상도 버전 1개 더 생성해줘
좀 더 밝은 조명으로"
```

**실제 결과:**
- ⏱️ 생성 시간: 10-15초
- 💰 비용: **$0.03/이미지**
- 📸 품질: 포토리얼리스틱
- 🔒 보안: SynthID 워터마크 자동 포함
- ✅ 용도: 실제 배포, 프린트, 광고

### 시나리오 3: 프로젝트 문서 이미지

**상황**: README, 발표 자료, 문서화 이미지 필요

```
Step 1: 다이어그램/일러스트 (Nano Banana)
────────────────────
"generate_image_gemini 도구 사용:

prompt: Technical diagram showing a microservices architecture
with API gateway, multiple services, and databases.
Clean infographic style, blue and orange colors,
white background, clear labels

numberOfImages: 2"

Step 2: 아이콘 세트 생성
────────────────────
"키오스크용 아이콘 세트 생성:
1. Home icon
2. Menu icon
3. Cart icon
4. User profile icon

일관된 스타일로, 64x64px, 심플한 라인 아트"
```

**효과:**
- ✅ 디자이너 없이 빠른 비주얼 제작
- ✅ 문서화 품질 향상
- ✅ 팀 커뮤니케이션 개선

### 시나리오 4: 실전 워크플로우 (2단계 전략)

**전략**: Nano Banana로 테스트 → Imagen으로 최종화

```
1단계: 아이디어 탐색 (Nano Banana - 무료)
────────────────────
"generate_image_gemini로
배경 이미지 10가지 스타일 테스트
- 미니멀
- 따뜻한
- 모던
- 자연"

2단계: 최종 선정 및 고품질 생성 (Imagen 3 - 유료)
────────────────────
"2번 스타일이 좋네!
generate_image_imagen으로
최종 배포용 고해상도 버전 생성"
```

**비용 최적화:**
- 🟢 테스트 10회: $0 (Nano Banana)
- 🔵 최종 1회: $0.03 (Imagen)
- ✅ 총 비용: **$0.03** (vs 디자이너 외주 $50-100)

### 실전 팁

#### 1. 모델 선택 기준

| 목적 | 모델 | 이유 |
|------|------|------|
| 프로토타입 | Nano Banana 🍌 | 무료, 빠른 반복 |
| A/B 테스트 | Nano Banana 🍌 | 다양한 옵션 생성 |
| 최종 배포 | Imagen 3 | 포토리얼리스틱 |
| 문서화 | Nano Banana 🍌 | 충분한 품질 |
| 마케팅 자료 | Imagen 3 | 전문가급 품질 |
| 아이콘/로고 | Imagen 3 | 선명한 텍스트 |

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

#### 3. 반복 개선 패턴

```
1차: "기본 이미지 4개 생성"
2차: "2번이 좋은데, 색상을 파란색으로"
3차: "좀 더 밝게"
4차: "완벽해! Imagen으로 최종 버전"
```

#### 4. 비용 관리

```
월 예상 사용:
- Nano Banana: 무제한 (무료)
- Imagen 3: 주 5-10개
  → 월 $0.60-1.20

vs 디자이너 외주:
- 아이콘 세트: $100-200
- 배경 이미지: $50-100
- 총 절감: 월 $150-300
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

| 상황 | 모델 | 이유 |
|------|------|------|
| 프로토타입/테스트 | Nano Banana 🍌 | 무료, 빠른 반복 |
| 최종 배포 | Imagen 3 | 포토리얼리스틱 품질 |
| 문서화/README | Nano Banana 🍌 | 충분한 품질 |
| 마케팅/브랜딩 | Imagen 3 | 전문가급 품질 |

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
# 2단계 전략 (테스트 → 최종화)
1. Nano Banana로 무제한 테스트 (무료)
2. 최종 1-2개만 Imagen으로 생성

# 월 예상 비용
Nano Banana: 무제한 (무료)
Imagen 3: 주 5-10개 → 월 $0.60-1.20

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
