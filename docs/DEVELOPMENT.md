# 개발 가이드

이 문서는 공유오피스 데이터 수집기의 개발에 관한 가이드입니다.

## 개발 환경 설정

### 필수 요구사항
- Node.js 16.0.0 이상
- npm 7.0.0 이상
- Git

### 프로젝트 설정

```bash
# 저장소 클론
git clone https://github.com/DevJihwan/shared-office-finder.git
cd shared-office-finder

# 의존성 설치
npm install

# 개발 모드 실행
npm run dev
```

## 프로젝트 구조

```
src/
├── main.js              # Electron 메인 프로세스
├── config/
│   └── regions.js       # 지역 및 키워드 설정
├── scrapers/
│   └── naverMapScraper.js # 네이버 지도 스크래퍼
├── utils/
│   ├── logger.js        # 로깅 유틸리티
│   ├── errorHandler.js  # 에러 처리
│   └── dataProcessor.js # 데이터 처리
scripts/
├── installer.nsh        # Windows 설치 스크립트
└── cleanup.js          # 정리 스크립트
assets/
└── icon.png            # 앱 아이콘
```

## 개발 워크플로우

### 1. 기능 개발
1. feature 브랜치 생성: `git checkout -b feature/새기능`
2. 코드 작성 및 테스트
3. 커밋: `git commit -m "feat: 새 기능 추가"`
4. Push: `git push origin feature/새기능`
5. Pull Request 생성

### 2. 커밋 메시지 규칙
- `feat:` 새로운 기능 추가
- `fix:` 버그 수정
- `docs:` 문서 수정
- `style:` 코드 포맷팅
- `refactor:` 코드 리팩토링
- `test:` 테스트 추가
- `chore:` 빌드 프로세스 또는 보조 도구 변경

## 빌드 및 배포

### 개발 빌드
```bash
npm run pack  # 패키징만 (설치 파일 생성 안함)
```

### 프로덕션 빌드
```bash
npm run build          # 전체 플랫폼
npm run build:win      # Windows
npm run build:mac      # macOS
npm run build:linux    # Linux
```

### 빌드 결과물
- Windows: `dist/공유오피스-데이터-수집기-Setup-1.0.0.exe`
- macOS: `dist/공유오피스 데이터 수집기-1.0.0.dmg`
- Linux: `dist/공유오피스 데이터 수집기-1.0.0.AppImage`

## 코딩 스타일

### JavaScript
- ES6+ 문법 사용
- async/await 패턴 선호
- JSDoc 주석 작성
- 에러 처리 필수

### 예시 코드
```javascript
/**
 * 데이터를 처리하는 함수
 * @param {Array} data - 처리할 데이터
 * @returns {Promise<Array>} - 처리된 데이터
 */
async function processData(data) {
  try {
    const result = await someAsyncOperation(data);
    return result;
  } catch (error) {
    logger.error('데이터 처리 실패:', error);
    throw error;
  }
}
```

## 테스트

### 수동 테스트 체크리스트
- [ ] 키워드 추가/제거 기능
- [ ] 데이터 수집 진행 상황 표시
- [ ] 로그 메시지 정상 출력
- [ ] Excel/JSON 파일 저장
- [ ] 에러 처리 및 사용자 알림
- [ ] 진행률 표시 정확성

### 테스트 시나리오
1. **정상 케이스**: 키워드 1-2개로 소규모 수집
2. **대용량 케이스**: 키워드 5개 이상으로 대용량 수집
3. **에러 케이스**: 네트워크 오류 시뮬레이션
4. **엣지 케이스**: 특수문자 키워드, 긴 키워드명

## API 문서

### NaverMapScraper
```javascript
const scraper = new NaverMapScraper();

// 단일 쿼리 검색
const data = await scraper.fetchAllDataForQuery('서울 강남구 공유오피스');

// 다중 지역/키워드 검색
const allData = await scraper.collectAllData(regions, keywords, progressCallback, logCallback);
```

### DataProcessor
```javascript
const processor = new DataProcessor();

// 중복 제거
const deduplicated = processor.deduplicateData(rawData);

// 데이터 처리
const processed = processor.processData(deduplicated);

// 파일 저장
processor.saveToExcel(processed, 'output.xlsx');
processor.saveToJson(processed, 'output.json');
```

## 디버깅

### 개발자 도구 활성화
```bash
NODE_ENV=development npm start
```

### 로그 파일 위치
- Windows: `%APPDATA%/공유오피스 데이터 수집기/logs/`
- macOS: `~/Library/Application Support/공유오피스 데이터 수집기/logs/`
- Linux: `~/.config/공유오피스 데이터 수집기/logs/`

### 일반적인 문제 해결

1. **네트워크 오류**
   - 인터넷 연결 확인
   - 방화벽 설정 확인
   - 프록시 설정 확인

2. **파일 저장 오류**
   - 디스크 공간 확인
   - 파일 권한 확인
   - 경로 유효성 확인

3. **메모리 부족**
   - 키워드 수 줄이기
   - Electron 재시작

## 성능 최적화

### 네트워크 요청 최적화
- 요청 간 적절한 지연 시간 설정 (현재 500ms)
- 재시도 로직 구현 (최대 3회)
- Exponential backoff 패턴 사용

### 메모리 관리
- 대용량 데이터 스트리밍 처리
- 불필요한 객체 참조 해제
- 가비지 컬렉션 고려

### UI 반응성
- 비동기 처리로 UI 블로킹 방지
- 진행률 표시로 사용자 경험 개선
- 실시간 로그 업데이트

## 보안 고려사항

### 데이터 보호
- 수집된 데이터 로컬 저장만 허용
- 개인정보 수집 최소화
- 데이터 전송 시 암호화 고려

### 코드 보안
- 외부 입력 검증
- SQL 인젝션 방지 (해당 없음)
- XSS 방지를 위한 입력 이스케이프

## 기여 가이드

### 이슈 리포팅
1. GitHub Issues에서 기존 이슈 확인
2. 재현 가능한 단계 포함
3. 환경 정보 (OS, Node.js 버전 등) 명시
4. 스크린샷 첨부 (UI 관련 이슈)

### Pull Request
1. Feature 브랜치에서 작업
2. 테스트 통과 확인
3. 문서 업데이트 (필요시)
4. 코드 리뷰 요청

## 라이선스

MIT 라이선스를 따릅니다. 자세한 내용은 LICENSE 파일을 참조하세요.