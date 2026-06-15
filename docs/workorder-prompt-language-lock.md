# 작업 의뢰서 — 출력 언어 락 (결론·갈림길 제목 영어 혼용 차단)

> 담당: **Sonnet** (프롬프트 텍스트 삽입 — 명세 닫힘, 로직 무수정) / 작성: Fable / 검수: 운영자 전후 비교
> 대상 레포: `council/` · 파일: `lib/prompts/orchestrator.ts`
> 트리거: 실기기 검증(2026-06-14)에서 결론/결정지도 제목에 영어 혼용 발견 —
> "초과근로 시키지 않으면 통 **Through**?", "✦ 자격 미달 **THEN**?", "현실주의자는 **checklist**도"

---

## 1. 진단

- `buildConclusionPrompt`(orchestrator.ts:211)에 **출력 언어 제약이 0줄**이다. 본문 지시는 한국어지만, `divided.topic`·`positions.side`·`openQuestions` 같은 **짧은 제목 자리**에서 모델이 영어로 코드 스위칭한다. 긴 본문은 안 새고 *제목만* 새는 게 증거 — terse/punchy 레지스터에서 영어 쏠림이 나오는 LLM 습성이다.
- 부수 증상: 모델이 **✦ 마커를 제목 텍스트에 직접 삽입**한다(`conclusionSchema`는 ✦를 요구하지 않음). ✦는 UI(못 본 각도 표시)가 붙이는 기호다 — 텍스트에 들어오면 이중 표기.
- 동일 메커니즘 위험: `buildChunkPrompt` nextTopics `label`(orchestrator.ts:175, "짧은 제목 15자 내외") — 같은 제목 자리. 함께 잠근다.
- **sanitize로 잡지 말 것** — 영어 정규식 제거는 정당한 고유명사·브랜드·코드까지 파손한다. 레버는 프롬프트 한 곳.

## 2. 박제 — 삽입 텍스트

### 2-A. `buildConclusionPrompt` — `[금지 사항]` 블록에 다음을 추가 (orchestrator.ts:299~304)

```
[출력 언어 — 절대 규칙]
- 모든 필드(consensus · divided.topic · positions.side · openQuestions)는
  한국어로만 쓴다. 한국어 제목·문장에 영어 단어를 섞지 마라.
- 일반 명사의 영어 표기 금지: "checklist" → "점검 목록", "then" → "그다음",
  "through" → "통과". (예외는 코드·제품 고유명사·브랜드명뿐.)
- 제목에 마커 기호(✦, ★, ✓ 등)를 넣지 마라. 강조 표시는 UI가 붙인다.
  텍스트 필드에는 순수 내용만 담는다.
```

### 2-B. `buildChunkPrompt` — nextTopics 규칙(orchestrator.ts:175 "label 은 짧은 제목…" 줄 아래)에 한 줄 추가

```
- label·hook 은 한국어로만 쓴다. 영어 단어 혼용·마커 기호(✦ 등) 금지.
```

## 3. 스키마 description (확인만, 수정 없음)

`conclusionSchema`의 `.describe()` 들은 이미 전부 한국어다(orchestrator.ts:69~108) — 유지. **영어 description을 새로 추가하지 말 것** — description 언어가 출력 레지스터를 오염시키는 또 다른 경로다.

## 4. 합격선

| 지표 | 합격선 |
| --- | --- |
| 동일 고민 3개 × 결론 재생성 → divided.topic·side·openQuestions 영어 단어 | 0건 (고유명사 제외) |
| 제목 필드 내 ✦·★ 등 마커 기호 | 0건 |
| 청크 nextTopics label·hook 영어 혼용 | 0건 |
| 회귀 — 결론 구조(consensus/divided/openQuestions)·evidenceMessageIds 추적 | 정상 |

## 5. 분담

- **Sonnet**: 2-A·2-B 텍스트 삽입 (프롬프트 문자열만, 로직·스키마 무수정).
- **운영자**: 같은 고민으로 결론·청크 재생성해 영어/마커 소거 확인 (전후 비교).

## 6. 비고

- 이 픽스는 `data/prompts.json` 어드민 편집 경로와 무관(결론 프롬프트는 코드 내 함수). 추후 결론 프롬프트도 어드민 이관 시 본 규칙을 같이 옮길 것.
- 근본 원인은 모델 습성이라 100% 박멸은 어렵다 — 합격선은 "동일 고민 3개에서 0건". 잔존 시 few-shot 제목 예시를 순한국어 펀치 톤으로 1~2개 추가하는 게 다음 레버.
