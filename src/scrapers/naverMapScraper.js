const axios = require('axios');

class NaverMapScraper {
  constructor() {
    this.baseUrl = 'https://map.naver.com/p/api/search/allSearch';
    this.searchCoord = encodeURIComponent('126.99760199999827;37.56384299999955');
    this.display = 50; // 한 번에 가져올 결과 수
    this.requestDelay = 500; // 요청 간 지연 시간 (ms)
  }

  /**
   * 요청 헤더 생성
   * @param {string} query - 검색 쿼리
   * @returns {Object} - HTTP 헤더
   */
  getHeaders(query) {
    const refererUrl = 'https://map.naver.com/p/search/' + encodeURIComponent(query) + '?c=12.00,0,0,0,dh';
    return {
      'accept': 'application/json, text/plain, */*',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept-language': 'ko-KR,ko;q=0.8,en-US;q=0.6,en;q=0.4',
      'cache-control': 'no-cache',
      'referer': refererUrl,
      'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
    };
  }

  /**
   * HTTP 요청에 재시도 로직 추가
   * @param {Function} requestFn - 요청 함수
   * @param {number} retries - 재시도 횟수
   * @param {number} backoff - 백오프 시간
   * @returns {Promise} - 요청 결과
   */
  async withRetry(requestFn, retries = 3, backoff = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await requestFn();
      } catch (err) {
        if (err.response && err.response.status === 503) {
          if (attempt === retries) {
            throw new Error(`최대 재시도 횟수(${retries}) 초과: ${err.message}`);
          }
          console.warn(`HTTP 503 에러, ${backoff}ms 후 재시도 (${attempt}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          backoff *= 2; // Exponential backoff
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
    const encodedQuery = encodeURIComponent(query);
    const url = `${this.baseUrl}?query=${encodedQuery}&type=all&searchCoord=${this.searchCoord}&boundary=&start=${start}&display=${this.display}`;
    const headers = this.getHeaders(query);

    return await this.withRetry(async () => {
      const response = await axios.get(url, { 
        headers,
        timeout: 30000 // 30초 타임아웃
      });
      return response.data;
    });
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
      console.log(`[${query}] 첫 페이지 요청 중...`);
      const firstResult = await this.fetchPage(query, start);
      
      if (!firstResult.result || !firstResult.result.place) {
        console.warn(`[${query}] 검색 결과가 없습니다.`);
        return [];
      }

      totalCount = firstResult.result.place.totalCount;
      console.log(`[${query}] 전체 결과 개수: ${totalCount}`);
      
      // 첫 페이지 데이터 추가
      if (firstResult.result.place.list) {
        allData.push(...firstResult.result.place.list);
      }
      
      start += this.display;

      // 나머지 페이지들 순차적으로 요청
      while (start <= totalCount && start <= 1000) { // 최대 1000개까지만 수집
        try {
          console.log(`[${query}] 페이지 ${Math.ceil(start / this.display)} 요청 중... (${start}/${totalCount})`);
          
          const result = await this.fetchPage(query, start);
          
          if (result && result.result && result.result.place && result.result.place.list) {
            allData.push(...result.result.place.list);
          }
          
          // 진행 상황 업데이트
          if (progressCallback) {
            const progress = Math.min((start / totalCount) * 100, 100);
            progressCallback(progress, `${query} - ${start}/${totalCount}`);
          }
          
        } catch (error) {
          console.error(`[${query}] 페이지 ${start} 요청 실패: ${error.message}`);
          // 개별 페이지 실패는 전체 중단하지 않고 계속 진행
        }
        
        start += this.display;
        
        // 요청 간 지연
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }

      console.log(`[${query}] 데이터 수집 완료: ${allData.length}개`);
      return allData;
      
    } catch (error) {
      console.error(`[${query}] 데이터 수집 실패: ${error.message}`);
      throw error;
    }
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
      logCallback('info', `총 ${totalQueries}개의 검색 쿼리를 실행합니다.`);
    }

    for (const region of regions) {
      for (const district of region.districts) {
        for (const keyword of keywords) {
          const query = `${region.province} ${district} ${keyword}`;
          
          try {
            if (logCallback) {
              logCallback('info', `==== ${query} 데이터 수집 시작 ====`);
            }
            
            const data = await this.fetchAllDataForQuery(query, (queryProgress, queryStatus) => {
              if (progressCallback) {
                const overallProgress = ((completedQueries / totalQueries) * 100) + 
                                      ((queryProgress / 100) * (1 / totalQueries) * 100);
                progressCallback(overallProgress, `${queryStatus}`);
              }
            });
            
            // 데이터에 메타정보 추가
            const enhancedData = data.map(item => ({
              ...item,
              province: region.province,
              district: district,
              keyword: keyword,
              searchQuery: query,
              collectedAt: new Date().toISOString()
            }));
            
            combinedData.push(...enhancedData);
            
            if (logCallback) {
              logCallback('success', `${query}: ${data.length}개 데이터 수집 완료`);
            }
            
          } catch (error) {
            if (logCallback) {
              logCallback('error', `${query} 수집 실패: ${error.message}`);
            }
          }
          
          completedQueries++;
          
          // 전체 진행 상황 업데이트
          if (progressCallback) {
            const overallProgress = (completedQueries / totalQueries) * 100;
            progressCallback(overallProgress, `완료: ${completedQueries}/${totalQueries}`);
          }
          
          // 요청 간 지연 (서버 부하 방지)
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (logCallback) {
      logCallback('success', `전체 데이터 수집 완료: ${combinedData.length}개`);
    }

    return combinedData;
  }
}

module.exports = NaverMapScraper;