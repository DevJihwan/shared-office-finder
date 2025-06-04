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

  /**\n   * 단일 페이지 데이터 요청\n   * @param {string} query - 검색 쿼리\n   * @param {number} start - 시작 인덱스\n   * @returns {Promise<Object>} - API 응답 데이터\n   */\n  async fetchPage(query, start = 1) {\n    const headers = this.getHeaders(query);\n    const variables = {\n      input: {\n        query: query,\n        start: start,\n        display: this.display,\n        adult: false,\n        spq: false,\n        queryRank: '',\n        x: this.searchCoord.x,\n        y: this.searchCoord.y,\n        clientX: this.clientCoord.x,\n        clientY: this.clientCoord.y,\n        bounds: this.bounds,\n        deviceType: 'pcmap'\n      }\n    };\n\n    return await this.withRetry(async () => {\n      const response = await axios.post(this.baseUrl, [{\n        operationName: 'getPlacesList',\n        query: this.getGraphQLQuery(),\n        variables\n      }], {\n        headers,\n        timeout: 30000 // 30초 타임아웃\n      });\n      \n      return response.data[0].data.businesses;\n    }, query);\n  }\n\n  /**\n   * 특정 쿼리에 대한 모든 데이터 수집\n   * @param {string} query - 검색 쿼리\n   * @param {Function} progressCallback - 진행 상황 콜백 함수\n   * @returns {Promise<Array>} - 수집된 데이터 배열\n   */\n  async fetchAllDataForQuery(query, progressCallback = null) {\n    let start = 1;\n    let allData = [];\n    let totalCount = 0;\n\n    try {\n      // 첫 페이지 요청으로 전체 개수 확인\n      console.log(`[GraphQL][${query}] 첫 페이지 요청 중...`);\n      const firstResult = await this.fetchPage(query, start);\n      \n      if (!firstResult || !firstResult.items) {\n        console.warn(`[GraphQL][${query}] 검색 결과가 없습니다.`);\n        return [];\n      }\n\n      totalCount = firstResult.total;\n      console.log(`[GraphQL][${query}] 전체 결과 개수: ${totalCount}`);\n      \n      // 첫 페이지 데이터 추가\n      if (firstResult.items) {\n        allData.push(...firstResult.items);\n      }\n      \n      start += this.display;\n\n      // 나머지 페이지들 순차적으로 요청\n      while (start <= totalCount && start <= 1000) { // 최대 1000개까지만 수집\n        try {\n          console.log(`[GraphQL][${query}] 페이지 ${Math.ceil(start / this.display)} 요청 중... (${start}/${totalCount})`);\n          \n          const result = await this.fetchPage(query, start);\n          \n          if (result && result.items) {\n            allData.push(...result.items);\n          }\n          \n          // 진행 상황 업데이트\n          if (progressCallback) {\n            const progress = Math.min((start / totalCount) * 100, 100);\n            progressCallback(progress, `GraphQL ${query} - ${start}/${totalCount}`);\n          }\n          \n        } catch (error) {\n          console.error(`[GraphQL][${query}] 페이지 ${start} 요청 실패: ${error.message}`);\n          // 개별 페이지 실패는 전체 중단하지 않고 계속 진행\n        }\n        \n        start += this.display;\n        \n        // 요청 간 지연\n        await new Promise(resolve => setTimeout(resolve, this.requestDelay));\n      }\n\n      console.log(`[GraphQL][${query}] 데이터 수집 완료: ${allData.length}개`);\n      return allData;\n      \n    } catch (error) {\n      console.error(`[GraphQL][${query}] 데이터 수집 실패: ${error.message}`);\n      throw error;\n    }\n  }\n\n  /**\n   * 지역 정보 파싱 (commonAddress 우선 사용)\n   * @param {Object} item - GraphQL 응답 아이템\n   * @returns {string} - 파싱된 지역 정보\n   */\n  parseRegionFromItem(item) {\n    if (item.commonAddress && item.commonAddress.length > 0) {\n      return item.commonAddress[0];\n    }\n    \n    // commonAddress가 없으면 address에서 추출\n    if (item.address) {\n      const addressParts = item.address.split(' ');\n      if (addressParts.length >= 3) {\n        return `${addressParts[0]} ${addressParts[1]} ${addressParts[2]}`;\n      } else if (addressParts.length >= 2) {\n        return `${addressParts[0]} ${addressParts[1]}`;\n      }\n    }\n    \n    return '미분류';\n  }\n\n  /**\n   * GraphQL 데이터를 표준 형식으로 변환\n   * @param {Object} item - GraphQL 응답 아이템\n   * @param {string} province - 검색한 시/도\n   * @param {string} district - 검색한 구/군\n   * @param {string} keyword - 검색 키워드\n   * @param {string} searchQuery - 전체 검색 쿼리\n   * @returns {Object} - 표준화된 데이터\n   */\n  transformGraphQLItem(item, province, district, keyword, searchQuery) {\n    return {\n      // 기존 naverMapScraper와 동일한 필드 구조 유지\n      name: item.name,\n      tel: item.phone || item.virtualPhone,\n      address: item.address,\n      roadAddress: item.roadAddress,\n      shortAddress: item.commonAddress || [],\n      province: province,\n      district: district,\n      keyword: keyword,\n      searchQuery: searchQuery,\n      collectedAt: new Date().toISOString(),\n      // GraphQL 전용 추가 정보\n      id: item.id,\n      category: item.category,\n      x: item.x,\n      y: item.y,\n      visitorReviewCount: item.visitorReviewCount,\n      visitorReviewScore: item.visitorReviewScore,\n      source: 'graphql' // 데이터 출처 구분\n    };\n  }\n\n  /**\n   * 여러 지역과 키워드에 대한 데이터 수집\n   * @param {Array} regions - 지역 목록\n   * @param {Array} keywords - 키워드 목록\n   * @param {Function} progressCallback - 진행 상황 콜백\n   * @param {Function} logCallback - 로그 콜백\n   * @returns {Promise<Array>} - 수집된 모든 데이터\n   */\n  async collectAllData(regions, keywords, progressCallback = null, logCallback = null) {\n    let combinedData = [];\n    let totalQueries = 0;\n    let completedQueries = 0;\n\n    // 전체 쿼리 수 계산\n    regions.forEach(region => {\n      totalQueries += region.districts.length * keywords.length;\n    });\n\n    if (logCallback) {\n      logCallback('info', `[GraphQL] 총 ${totalQueries}개의 검색 쿼리를 실행합니다.`);\n    }\n\n    for (const region of regions) {\n      for (const district of region.districts) {\n        for (const keyword of keywords) {\n          const query = `${region.province} ${district} ${keyword}`;\n          \n          try {\n            if (logCallback) {\n              logCallback('info', `[GraphQL] ==== ${query} 데이터 수집 시작 ====`);\n            }\n            \n            const data = await this.fetchAllDataForQuery(query, (queryProgress, queryStatus) => {\n              if (progressCallback) {\n                const overallProgress = ((completedQueries / totalQueries) * 100) + \n                                      ((queryProgress / 100) * (1 / totalQueries) * 100);\n                progressCallback(overallProgress, `${queryStatus}`);\n              }\n            });\n            \n            // 데이터에 메타정보 추가 및 변환\n            const enhancedData = data.map(item => \n              this.transformGraphQLItem(item, region.province, district, keyword, query)\n            );\n            \n            combinedData.push(...enhancedData);\n            \n            if (logCallback) {\n              logCallback('success', `[GraphQL] ${query}: ${data.length}개 데이터 수집 완료`);\n            }\n            \n          } catch (error) {\n            if (logCallback) {\n              logCallback('error', `[GraphQL] ${query} 수집 실패: ${error.message}`);\n            }\n          }\n          \n          completedQueries++;\n          \n          // 전체 진행 상황 업데이트\n          if (progressCallback) {\n            const overallProgress = (completedQueries / totalQueries) * 100;\n            progressCallback(overallProgress, `[GraphQL] 완료: ${completedQueries}/${totalQueries}`);\n          }\n          \n          // 요청 간 지연 (서버 부하 방지)\n          await new Promise(resolve => setTimeout(resolve, 1000));\n        }\n      }\n    }\n\n    if (logCallback) {\n      logCallback('success', `[GraphQL] 전체 데이터 수집 완료: ${combinedData.length}개`);\n    }\n\n    return combinedData;\n  }\n}\n\nmodule.exports = NaverGraphQLScraper;