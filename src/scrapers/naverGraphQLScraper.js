


const axios = require('axios');

class NaverGraphQLScraper {
  constructor() {
    this.baseUrl = 'https://pcmap-api.place.naver.com/graphql';
    this.searchCoord = { x: '126.97838799999755', y: '37.566610000000395' };
    this.clientCoord = { x: '126.960025', y: '37.550192' };
    this.bounds = '126.66012780712356;37.4026058227488;127.30351464794438;37.72482300100256';
    this.display = 70;
    this.requestDelay = 500; // 요청 간 지연 시간 (ms)
  }

  /**
   * 요청 헤더 생성
   * @param {string} query - 검색 쿼리
   * @returns {Object} - HTTP 헤더
   */
  getHeaders(query) {
    const refererUrl = `https://pcmap.place.naver.com/place/list?query=${encodeURIComponent(query)}&x=${this.searchCoord.x}&y=${this.searchCoord.y}&clientX=${this.clientCoord.x}&clientY=${this.clientCoord.y}&bounds=${encodeURIComponent(this.bounds)}&display=${this.display}&locale=ko&mapUrl=https%3A%2F%2Fmap.naver.com%2Fp%2Fsearch%2F${encodeURIComponent(query)}`;
    
    return {
      'accept': '*/*',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept-language': 'ko',
      'content-type': 'application/json',
      'cookie': 'NNB=KCAJ3SDR33WWO; NFS=2; ASID=798e084600000196662d912f00000059; m_loc=fc30dc3d8b143e0a47dd8fc6ed6078b757bc5d687b8fd0b9c9fca325c979023f; NV_WETR_LAST_ACCESS_RGN_M="MTEyNjA1Mzk="; NV_WETR_LOCATION_RGN_M="MTEyNjA1Mzk="; PLACE_LANGUAGE=ko; nid_inf=2003425767; NID_JKL=1FY/7lel7aQCxuKJ7J4KabzLmu9xkOHyDG6X6y6q9/I=; tooltipDisplayed=true; NACT=1; SRT30=1746609439; NAC=idqVBkw56; BUC=sDKjq0B8PdJNowScbThR579zVA81-E4DY6CyHjZm850=',
      'origin': 'https://pcmap.place.naver.com',
      'priority': 'u=1, i',
      'referer': refererUrl,
      'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      'x-wtm-graphql': 'eyJhcmciOiLshJzsmrjtirnrs4Tsi5wg7KSR6rWsIOqzoCIsInR5cGUiOiJwbGFjZSIsInNvdXJjZSI6InBsYWNlIn0'
    };
  }

  /**
   * GraphQL 쿼리
   */
  getGraphQLQuery() {
    return `
      query getPlacesList($input: PlacesInput) {
        businesses: places(input: $input) {
          total
          items {
            id
            name
            normalizedName
            category
            roadAddress
            address
            fullAddress
            commonAddress
            phone
            virtualPhone
            businessHours
            imageUrl
            imageCount
            x
            y
            visitorReviewCount
            visitorReviewScore
            __typename
          }
          __typename
        }
      }
    `;
  }

  /**
   * HTTP 요청에 재시도 로직 추가
   * @param {Function} requestFn - 요청 함수
   * @param {string} query - 검색 쿼리 (로깅용)
   * @param {number} retries - 재시도 횟수
   * @param {number} backoff - 백오프 시간
   * @returns {Promise} - 요청 결과
   */
  async withRetry(requestFn, query, retries = 3, backoff = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await requestFn();
      } catch (err) {
        console.error(`[${query}] 시도 ${attempt}/${retries} 에러:`, err.message);
        if (err.response) {
          console.error(`[${query}] 응답 상태: ${err.response.status}`);
        }
        
        if (err.response && err.response.status === 503) {
          if (attempt === retries) {
            throw new Error(`최대 재시도 횟수(${retries}) 초과: ${err.message}`);
          }
          console.warn(`[${query}] HTTP 503 에러, ${backoff}ms 후 재시도 (${attempt}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          backoff *= 2;
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * 단일 페이지 데이터 요청
   * @param {string} query - 검색 쿼리
   * @param {number} start - 시작 인덱스
   * @returns {Promise<Object>} - API 응답 데이터
   */
  async fetchPage(query, start = 1) {
    const headers = this.getHeaders(query);
    const variables = {
      input: {
        query: query,
        start: start,
        display: this.display,
        adult: false,
        spq: false,
        queryRank: '',
        x: this.searchCoord.x,
        y: this.searchCoord.y,
        clientX: this.clientCoord.x,
        clientY: this.clientCoord.y,
        bounds: this.bounds,
        deviceType: 'pcmap'
      }
    };

    return await this.withRetry(async () => {
      const response = await axios.post(this.baseUrl, [{
        operationName: 'getPlacesList',
        query: this.getGraphQLQuery(),
        variables
      }], {
        headers,
        timeout: 30000 // 30초 타임아웃
      });
      
      return response.data[0].data.businesses;
    }, query);
  }

  /**
   * 특정 쿼리에 대한 모든 데이터 수집
   * @param {string} query - 검색 쿼리
   * @param {Function} progressCallback - 진행 상황 콜백 함수
   * @returns {Promise<Array>} - 수집된 데이터 배열
   */
  async fetchAllDataForQuery(query, progressCallback = null) {
    let start = 1;
    let allData = [];
    let totalCount = 0;

    try {
      // 첫 페이지 요청으로 전체 개수 확인
      console.log(`[GraphQL][${query}] 첫 페이지 요청 중...`);
      const firstResult = await this.fetchPage(query, start);
      
      if (!firstResult || !firstResult.items) {
        console.warn(`[GraphQL][${query}] 검색 결과가 없습니다.`);
        return [];
      }

      totalCount = firstResult.total;
      console.log(`[GraphQL][${query}] 전체 결과 개수: ${totalCount}`);
      
      // 첫 페이지 데이터 추가
      if (firstResult.items) {
        allData.push(...firstResult.items);
      }
      
      start += this.display;

      // 나머지 페이지들 순차적으로 요청
      while (start <= totalCount && start <= 1000) { // 최대 1000개까지만 수집
        try {
          console.log(`[GraphQL][${query}] 페이지 ${Math.ceil(start / this.display)} 요청 중... (${start}/${totalCount})`);
          
          const result = await this.fetchPage(query, start);
          
          if (result && result.items) {
            allData.push(...result.items);
          }
          
          // 진행 상황 업데이트
          if (progressCallback) {
            const progress = Math.min((start / totalCount) * 100, 100);
            progressCallback(progress, `GraphQL ${query} - ${start}/${totalCount}`);
          }
          
        } catch (error) {
          console.error(`[GraphQL][${query}] 페이지 ${start} 요청 실패: ${error.message}`);
          // 개별 페이지 실패는 전체 중단하지 않고 계속 진행
        }
        
        start += this.display;
        
        // 요청 간 지연
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }

      console.log(`[GraphQL][${query}] 데이터 수집 완료: ${allData.length}개`);
      return allData;
      
    } catch (error) {
      console.error(`[GraphQL][${query}] 데이터 수집 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 지역 정보 파싱 (commonAddress 우선 사용)
   * @param {Object} item - GraphQL 응답 아이템
   * @returns {string} - 파싱된 지역 정보
   */
  parseRegionFromItem(item) {
    if (item.commonAddress && item.commonAddress.length > 0) {
      return item.commonAddress[0];
    }
    
    // commonAddress가 없으면 address에서 추출
    if (item.address) {
      const addressParts = item.address.split(' ');
      if (addressParts.length >= 3) {
        return `${addressParts[0]} ${addressParts[1]} ${addressParts[2]}`;
      } else if (addressParts.length >= 2) {
        return `${addressParts[0]} ${addressParts[1]}`;
      }
    }
    
    return '미분류';
  }

  /**
   * GraphQL 데이터를 표준 형식으로 변환
   * @param {Object} item - GraphQL 응답 아이템
   * @param {string} province - 검색한 시/도
   * @param {string} district - 검색한 구/군
   * @param {string} keyword - 검색 키워드
   * @param {string} searchQuery - 전체 검색 쿼리
   * @returns {Object} - 표준화된 데이터
   */
  transformGraphQLItem(item, province, district, keyword, searchQuery) {
    return {
      // 기존 naverMapScraper와 동일한 필드 구조 유지
      name: item.name,
      tel: item.phone || item.virtualPhone,
      address: item.address,
      roadAddress: item.roadAddress,
      shortAddress: item.commonAddress || [],
      province: province,
      district: district,
      keyword: keyword,
      searchQuery: searchQuery,
      collectedAt: new Date().toISOString(),
      // GraphQL 전용 추가 정보
      id: item.id,
      category: item.category,
      x: item.x,
      y: item.y,
      visitorReviewCount: item.visitorReviewCount,
      visitorReviewScore: item.visitorReviewScore,
      source: 'graphql' // 데이터 출처 구분
    };
  }

  /**
   * 여러 지역과 키워드에 대한 데이터 수집
   * @param {Array} regions - 지역 목록
   * @param {Array} keywords - 키워드 목록
   * @param {Function} progressCallback - 진행 상황 콜백
   * @param {Function} logCallback - 로그 콜백
   * @returns {Promise<Array>} - 수집된 모든 데이터
   */
  async collectAllData(regions, keywords, progressCallback = null, logCallback = null) {
    let combinedData = [];
    let totalQueries = 0;
    let completedQueries = 0;

    // 전체 쿼리 수 계산
    regions.forEach(region => {
      totalQueries += region.districts.length * keywords.length;
    });

    if (logCallback) {
      logCallback('info', `[GraphQL] 총 ${totalQueries}개의 검색 쿼리를 실행합니다.`);
    }

    for (const region of regions) {
      for (const district of region.districts) {
        for (const keyword of keywords) {
          const query = `${region.province} ${district} ${keyword}`;
          
          try {
            if (logCallback) {
              logCallback('info', `[GraphQL] ==== ${query} 데이터 수집 시작 ====`);
            }
            
            const data = await this.fetchAllDataForQuery(query, (queryProgress, queryStatus) => {
              if (progressCallback) {
                const overallProgress = ((completedQueries / totalQueries) * 100) + 
                                      ((queryProgress / 100) * (1 / totalQueries) * 100);
                progressCallback(overallProgress, `${queryStatus}`);
              }
            });
            
            // 데이터에 메타정보 추가 및 변환
            const enhancedData = data.map(item => 
              this.transformGraphQLItem(item, region.province, district, keyword, query)
            );
            
            combinedData.push(...enhancedData);
            
            if (logCallback) {
              logCallback('success', `[GraphQL] ${query}: ${data.length}개 데이터 수집 완료`);
            }
            
          } catch (error) {
            if (logCallback) {
              logCallback('error', `[GraphQL] ${query} 수집 실패: ${error.message}`);
            }
          }
          
          completedQueries++;
          
          // 전체 진행 상황 업데이트
          if (progressCallback) {
            const overallProgress = (completedQueries / totalQueries) * 100;
            progressCallback(overallProgress, `[GraphQL] 완료: ${completedQueries}/${totalQueries}`);
          }
          
          // 요청 간 지연 (서버 부하 방지)
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (logCallback) {
      logCallback('success', `[GraphQL] 전체 데이터 수집 완료: ${combinedData.length}개`);
    }

    return combinedData;
  }
}

module.exports = NaverGraphQLScraper;
