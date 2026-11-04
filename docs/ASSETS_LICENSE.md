# 에셋 라이선스

모든 그래픽은 외부 이미지 없이 코드로 직접 생성했다 (`apps/web/art/` → `pnpm --filter web art`).
고정 팔레트 51색(`apps/web/art/palette.hex`)만 사용한다 — 생성기가 팔레트 인덱스만 저장하므로 구조적으로 보장.

| 에셋 | 파일 | 출처 | 라이선스 | 상업 이용 |
|---|---|---|---|---|
| 배경 11종 (연구실 낮/저녁/밤/새벽, 교수실, 강의실, 자취방, 학회장, 카페, 상담실, 편의점) | `public/art/scene-*.png` | 자체 제작 (art/scenes.ts, art/props.ts) | 프로젝트 소유 | 가능 |
| 캐릭터 11명 × 표정 6 × 프레임 3 | `public/art/char-*.png` | 자체 제작 (art/characters.ts) | 프로젝트 소유 | 가능 |
| 이펙트 시트 (김, 코드 스크롤, 비, Zzz, 반짝임, 불꽃놀이, 먹구름, 메일, 디더 전환, 빛, 달력) | `public/art/fx-*.png` | 자체 제작 (art/fx.ts) | 프로젝트 소유 | 가능 |
| 도장 6종 (ACCEPT/REJECT/ORAL/MAJOR/MINOR/PASS) | `public/art/stamp-*.png` | 자체 제작, 5x7 도트 폰트(art/lib/font.ts) | 프로젝트 소유 | 가능 |
| 아이콘 16종, UI 9-slice 프레임 4종 | `public/art/icons.png`, `ui-*.png` | 자체 제작 | 프로젝트 소유 | 가능 |
| 파비콘 | `public/favicon.svg` | 자체 제작 | 프로젝트 소유 | 가능 |
| 한글 도트 폰트 Galmuri11 / Galmuri11 Bold | npm `galmuri@2.40.3` | Lee Minseo (quiple) | SIL OFL 1.1 | 가능 (폰트 단독 판매 금지) |

> Aseprite 등으로 손보정한 PNG는 생성기를 다시 돌리면 덮어써진다 — 보정본은 별도 파일명으로 저장하고 manifest에서 교체할 것.
> 외부 에셋(이미지·사운드)을 추가하면 이 표에 출처·라이선스·상업 가능 여부를 기록한다.
