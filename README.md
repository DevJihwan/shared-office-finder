# 공유오피스 데이터 수집기

네이버 지도 API를 활용하여 전국의 공유오피스, 코워킹스페이스 정보를 수집하는 Electron 기반 데스크톱 애플리케이션입니다.

## ✨ 주요 기능

### 🔄 듀얼 API 데이터 수집
- **네이버 지도 API**: 기존 검색 API를 통한 데이터 수집
- **GraphQL API**: 추가 데이터 소스를 통한 보완 수집
- **스마트 통합**: 상호명 기준 중복 제거로 최대한 많은 고유 데이터 확보

### 📍 지역별 맞춤 검색
- 전국 시/도, 구/군 단위 세분화 검색
- 사용자 정의 지역 선택 가능
- 지역별 수집 통계 제공

### 🎯 키워드 기반 필터링
- 기본 검색 키워드: 공유오피스, 코워킹스페이스 등
- 사용자 정의 키워드 추가/삭제
- 제외 키워드로 불필요한 데이터 필터링

### 📊 풍부한 데이터 정보
수집되는 데이터 항목:
- 지역/지역구
- 상호명
- 전화번호
- 지번주소/도로명주소
- 홈페이지
- 가격정보
- 수집일시
- 검색키워드
- **데이터소스** (지도 API / GraphQL API 구분)

### 💾 다양한 내보내기 형식
- **Excel (.xlsx)**: 스프레드시트 형태로 편리한 데이터 관리
- **JSON (.json)**: 개발자 친화적 구조화된 데이터

## 🚀 설치 및 실행

### 시스템 요구사항
- Node.js 14.0 이상
- Windows, macOS, Linux 지원

### 설치 방법
```bash
# 저장소 클론
git clone https://github.com/DevJihwan/shared-office-finder.git
cd shared-office-finder

# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 프로덕션 빌드
npm run build
```

## 🔧 기술 구조

### 아키텍처
```
src/
├── main.js                 # 메인 프로세스 (Electron)
├── index.html             # 렌더러 UI
├── scrapers/              # 데이터 수집 모듈
│   ├── naverMapScraper.js     # 네이버 지도 API 스크래퍼
│   └── naverGraphQLScraper.js # GraphQL API 스크래퍼
├── utils/                 # 유틸리티 모듈
│   ├── dataProcessor.js       # 데이터 처리 및 통합
│   ├── errorHandler.js        # 에러 처리
│   └── logger.js             # 로깅
└── config/                # 설정 파일
    └── regions.js            # 지역 및 키워드 설정
```

### 핵심 컴포넌트

#### 🔍 NaverMapScraper
- 네이버 지도 검색 API 활용
- 페이지네이션을 통한 대량 데이터 수집
- 재시도 로직으로 안정성 확보

#### 🔍 NaverGraphQLScraper  
- 네이버 GraphQL API 활용
- 기존 API에서 누락되는 데이터 보완
- 동일한 인터페이스로 일관된 데이터 처리

#### 🔄 DataProcessor
- **combineDataSources()**: 두 API 데이터의 스마트 통합
- 상호명 기준 중복 제거
- 데이터 표준화 및 정제
- Excel/JSON 내보내기

## 💡 데이터 수집 프로세스

### 1단계: 네이버 지도 API 수집
```
선택된 지역 × 키워드 조합으로 검색
└── 페이지네이션으로 전체 데이터 수집
    └── 에러 처리 및 재시도
```

### 2단계: GraphQL API 보완 수집
```
동일한 지역 × 키워드로 GraphQL 검색
└── 추가 데이터 소스에서 누락 데이터 확보
    └── 다른 엔드포인트로 다양성 확보
```

### 3단계: 데이터 통합
```
두 소스 데이터 병합
├── 상호명 기준 중복 제거
├── 제외 키워드 필터링
└── 최종 데이터 정제
```

## 📈 수집 통계

애플리케이션은 상세한 수집 통계를 제공합니다:

- **총 수집 건수**
- **데이터 소스별 분포**
  - 지도 API 수집: X건
  - GraphQL API 추가: Y건
- **지역별 분포**
- **전화번호/홈페이지 보유율**
- **중복 제거 현황**

## 🛠️ 사용법

### 기본 수집 과정
1. **지역 선택**: 수집하고자 하는 시/도 선택
2. **키워드 설정**: 검색 키워드 및 제외 키워드 설정
3. **수집 시작**: 듀얼 API로 자동 수집 시작
4. **결과 확인**: 통합된 데이터 및 통계 확인
5. **내보내기**: Excel 또는 JSON 형태로 저장

### 고급 설정
- **제외 키워드**: 카페, 부동산 등 불필요한 업종 제외
- **지역 세분화**: 구/군 단위까지 세밀한 지역 선택
- **키워드 조합**: 여러 키워드로 포괄적 검색

## 🔒 데이터 정책

### 수집 정책
- 공개된 네이버 지도 정보만 수집
- 개인정보 수집 최소화
- 상업적 목적 이용 시 네이버 이용약관 준수 필요

### 데이터 품질
- 실시간 중복 제거
- 전화번호 형식 자동 정규화
- 주소 정보 표준화
- 데이터 출처 명시

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🤝 기여하기

버그 리포트, 기능 제안, 코드 기여를 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 지원

문제가 발생하거나 질문이 있으시면 [GitHub Issues](https://github.com/DevJihwan/shared-office-finder/issues)를 통해 문의해 주세요.

---

**⚠️ 주의사항**: 본 도구는 공개된 정보만을 수집하며, 네이버의 서비스 이용약관을 준수해야 합니다. 수집된 데이터의 상업적 이용 시에는 관련 법규와 이용약관을 확인하시기 바랍니다.