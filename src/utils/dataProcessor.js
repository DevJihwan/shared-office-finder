const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class DataProcessor {
  constructor() {
    this.processedData = [];
  }

  /**
   * 데이터 중복 제거
   * @param {Array} data - 원본 데이터
   * @returns {Array} - 중복 제거된 데이터
   */
  deduplicateData(data) {
    const seen = new Set();
    const deduplicated = [];

    for (const item of data) {
      // 더 안전한 중복 제거 키 생성
      const name = item['상호명'] || item.name || '';
      const address = item['도로명주소'] || item['지번주소'] || item.roadAddress || item.address || '';
      const tel = item['전화번호'] || item.tel || '';
      
      const key = `${name}|${address}|${tel}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(item);
      }
    }

    console.log(`원본 데이터 개수: ${data.length}, 중복 제거 후: ${deduplicated.length}`);
    return deduplicated;
  }

  /**
   * 두 데이터 소스 통합 (상호명 기준으로 중복 제거)
   * @param {Array} existingData - 기존 데이터 (naverMapScraper)
   * @param {Array} newData - 새로운 데이터 (GraphQL API)
   * @returns {Object} - {combinedData: 통합된 데이터, addedCount: 추가된 데이터 수}
   */
  combineDataSources(existingData, newData) {
    console.log(`기존 데이터: ${existingData.length}개, 새로운 데이터: ${newData.length}개`);
    
    // 기존 데이터의 상호명 목록을 Set으로 생성 (빠른 검색을 위해)
    const existingBusinessNames = new Set();
    existingData.forEach(item => {
      const businessName = (item['상호명'] || item.name || '').trim().toLowerCase();
      if (businessName) {
        existingBusinessNames.add(businessName);
      }
    });

    console.log(`기존 데이터 상호명 개수: ${existingBusinessNames.size}개`);

    // 새로운 데이터에서 기존에 없는 상호명만 필터링
    const uniqueNewData = [];
    let duplicateCount = 0;

    newData.forEach(item => {
      const businessName = (item['상호명'] || item.name || '').trim().toLowerCase();
      
      if (businessName && !existingBusinessNames.has(businessName)) {
        uniqueNewData.push(item);
        // 추가된 상호명을 기존 목록에도 추가 (같은 새 데이터 내에서의 중복 방지)
        existingBusinessNames.add(businessName);
      } else {
        duplicateCount++;
        console.log(`중복 제외: ${item['상호명'] || item.name || '알 수 없음'}`);
      }
    });

    // 기존 데이터와 고유한 새 데이터 결합
    const combinedData = [...existingData, ...uniqueNewData];

    console.log(`통합 결과: 기존 ${existingData.length}개 + 신규 ${uniqueNewData.length}개 = 총 ${combinedData.length}개`);
    console.log(`GraphQL에서 중복으로 제외된 데이터: ${duplicateCount}개`);

    return {
      combinedData: combinedData,
      addedCount: uniqueNewData.length,
      duplicateCount: duplicateCount
    };
  }

  /**
   * 제외 키워드로 데이터 필터링
   * @param {Array} data - 필터링할 데이터
   * @param {Array} excludeKeywords - 제외 키워드 목록
   * @returns {Object} - {filteredData: 필터링된 데이터, excludedCount: 제외된 데이터 수}
   */
  filterByExcludeKeywords(data, excludeKeywords = []) {
    if (excludeKeywords.length === 0) {
      return { filteredData: data, excludedCount: 0 };
    }

    const filteredData = [];
    let excludedCount = 0;

    for (const item of data) {
      const businessName = (item['상호명'] || '').toLowerCase();
      
      // 제외 키워드가 상호명에 포함되어 있는지 확인
      const shouldExclude = excludeKeywords.some(keyword => 
        businessName.includes(keyword.toLowerCase())
      );

      if (shouldExclude) {
        excludedCount++;
        console.log(`제외된 데이터: ${item['상호명']} (제외 키워드 포함)`);\n      } else {\n        filteredData.push(item);\n      }\n    }\n\n    console.log(`제외 키워드 필터링: ${data.length}개 → ${filteredData.length}개 (${excludedCount}개 제외)`);\n    return { filteredData, excludedCount };\n  }\n\n  /**\n   * 지역 정보를 지역과 지역구로 분리\n   * @param {Object} item - 데이터 아이템\n   * @returns {Object} - {region: '서울특별시', district: '종로구'}\n   */\n  parseRegionInfo(item) {\n    let region = '';\n    let district = '';\n\n    // 지역 정보 추출 (우선순위: province > shortAddress > address 파싱)\n    if (item.province && item.district) {\n      region = item.province;\n      district = item.district;\n    } else if (item.shortAddress && item.shortAddress.length > 0) {\n      const fullRegion = item.shortAddress[0];\n      const regionParts = fullRegion.split(' ');\n      if (regionParts.length >= 2) {\n        region = regionParts[0];\n        district = regionParts[1];\n      } else {\n        region = fullRegion;\n        district = '';\n      }\n    } else if (item.roadAddress) {\n      // 도로명주소에서 지역 추출\n      const addressParts = item.roadAddress.split(' ');\n      if (addressParts.length >= 2) {\n        region = addressParts[0];\n        district = addressParts[1];\n      } else if (addressParts.length === 1) {\n        region = addressParts[0];\n        district = '';\n      }\n    } else if (item.address) {\n      // 지번주소에서 지역 추출\n      const addressParts = item.address.split(' ');\n      if (addressParts.length >= 2) {\n        region = addressParts[0];\n        district = addressParts[1];\n      } else if (addressParts.length === 1) {\n        region = addressParts[0];\n        district = '';\n      }\n    }\n\n    return {\n      region: region || '미분류',\n      district: district || '미분류'\n    };\n  }\n\n  /**\n   * 데이터 정제 및 표준화\n   * @param {Array} rawData - 원본 데이터\n   * @returns {Array} - 정제된 데이터\n   */\n  processData(rawData) {\n    console.log('Processing data, sample item:', rawData[0]);\n    \n    return rawData.map(item => {\n      // 지역 정보 분리\n      const regionInfo = this.parseRegionInfo(item);\n\n      // 요청된 순서대로 컬럼 구성\n      return {\n        \"지역\": regionInfo.region,\n        \"지역구\": regionInfo.district,\n        \"상호명\": item.name || item.title || '',\n        \"전화번호\": this.formatPhoneNumber(item.tel || item.phone),\n        \"지번주소\": item.address || '',\n        \"도로명주소\": item.roadAddress || item.road_address || '',\n        \"홈페이지\": item.homePage || item.homepage || item.url || '',\n        \"가격정보\": this.extractPriceInfo(item.menuInfo || item.description),\n        \"수집일시\": new Date().toISOString().split('T')[0],\n        \"키워드\": item.keyword || item.searchKeyword || '',\n        \"검색쿼리\": item.searchQuery || '',\n        \"데이터소스\": item.source || 'naver_map' // 데이터 출처 추가\n      };\n    });\n  }\n\n  /**\n   * 전화번호 포맷팅\n   * @param {string} tel - 원본 전화번호\n   * @returns {string} - 포맷팅된 전화번호\n   */\n  formatPhoneNumber(tel) {\n    if (!tel) return '';\n    \n    // 숫자만 추출\n    const numbers = tel.replace(/[^0-9]/g, '');\n    \n    if (numbers.length === 0) return '';\n    \n    // 일반적인 전화번호 형식으로 변환\n    if (numbers.length === 11 && numbers.startsWith('010')) {\n      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;\n    } else if (numbers.length === 10) {\n      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;\n    } else if (numbers.length === 8) {\n      return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;\n    } else if (numbers.length === 9) {\n      return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;\n    }\n    \n    return tel;\n  }\n\n  /**\n   * 가격 정보 추출\n   * @param {string} menuInfo - 메뉴 정보\n   * @returns {string} - 정제된 가격 정보\n   */\n  extractPriceInfo(menuInfo) {\n    if (!menuInfo) return '';\n    \n    // 가격 관련 키워드가 포함된 텍스트만 추출\n    const priceKeywords = ['원', '₩', '만원', '시간', '일', '월', '년', '무료', '할인'];\n    const lines = menuInfo.split('\\n').filter(line => \n      priceKeywords.some(keyword => line.includes(keyword))\n    );\n    \n    return lines.join(' | ').slice(0, 200); // 200자 제한\n  }\n\n  /**\n   * Excel 파일로 저장\n   * @param {Array} data - 저장할 데이터\n   * @param {string} filePath - 저장 경로\n   */\n  saveToExcel(data, filePath) {\n    try {\n      const worksheet = XLSX.utils.json_to_sheet(data);\n      \n      // 새로운 컬럼 순서에 맞게 컬럼 너비 설정\n      const columnWidths = [\n        { wch: 15 }, // 지역\n        { wch: 15 }, // 지역구\n        { wch: 25 }, // 상호명\n        { wch: 15 }, // 전화번호\n        { wch: 40 }, // 지번주소\n        { wch: 40 }, // 도로명주소\n        { wch: 30 }, // 홈페이지\n        { wch: 30 }, // 가격정보\n        { wch: 12 }, // 수집일시\n        { wch: 15 }, // 키워드\n        { wch: 25 }, // 검색쿼리\n        { wch: 15 }  // 데이터소스\n      ];\n      worksheet['!cols'] = columnWidths;\n      \n      const workbook = XLSX.utils.book_new();\n      XLSX.utils.book_append_sheet(workbook, worksheet, '공유오피스 데이터');\n      XLSX.writeFile(workbook, filePath);\n      \n      console.log(`Excel 파일 저장 완료: ${filePath}`);\n    } catch (error) {\n      console.error(`Excel 파일 저장 오류: ${error.message}`);\n      throw error;\n    }\n  }\n\n  /**\n   * JSON 파일로 저장\n   * @param {Array} data - 저장할 데이터\n   * @param {string} filePath - 저장 경로\n   */\n  saveToJson(data, filePath) {\n    try {\n      const jsonData = {\n        metadata: {\n          exportDate: new Date().toISOString(),\n          totalCount: data.length,\n          version: '1.0.0'\n        },\n        data: data\n      };\n      \n      fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');\n      console.log(`JSON 파일 저장 완료: ${filePath}`);\n    } catch (error) {\n      console.error(`JSON 파일 저장 오류: ${error.message}`);\n      throw error;\n    }\n  }\n\n  /**\n   * 파일 확장자에 따른 자동 저장\n   * @param {Array} data - 저장할 데이터\n   * @param {string} filePath - 저장 경로\n   */\n  saveData(data, filePath) {\n    const ext = path.extname(filePath).toLowerCase();\n    \n    if (ext === '.xlsx') {\n      this.saveToExcel(data, filePath);\n    } else if (ext === '.json') {\n      this.saveToJson(data, filePath);\n    } else {\n      throw new Error('지원하지 않는 파일 형식입니다. .xlsx 또는 .json 파일만 지원됩니다.');\n    }\n  }\n\n  /**\n   * 데이터 유효성 검사\n   * @param {Array} data - 검사할 데이터\n   * @returns {Object} - 검사 결과\n   */\n  validateData(data) {\n    if (!Array.isArray(data)) {\n      return { valid: false, message: '데이터가 배열 형식이 아닙니다.' };\n    }\n\n    if (data.length === 0) {\n      return { valid: false, message: '데이터가 비어있습니다.' };\n    }\n\n    const requiredFields = ['상호명'];\n    const missingFieldsItems = data.filter(item => \n      requiredFields.some(field => !item[field] || item[field].trim() === '')\n    );\n\n    if (missingFieldsItems.length > 0) {\n      console.log('Missing fields items sample:', missingFieldsItems.slice(0, 3));\n      return { \n        valid: false, \n        message: `${missingFieldsItems.length}개 항목에 필수 필드(상호명)가 누락되었습니다.` \n      };\n    }\n\n    return { valid: true, message: '데이터가 유효합니다.' };\n  }\n\n  /**\n   * 데이터 정리 및 정규화\n   * @param {Array} data - 정리할 데이터\n   * @returns {Array} - 정리된 데이터\n   */\n  cleanData(data) {\n    return data.map(item => {\n      const cleaned = {};\n      \n      // 각 필드 정리\n      Object.keys(item).forEach(key => {\n        let value = item[key];\n        \n        if (typeof value === 'string') {\n          // 문자열 정리: 앞뒤 공백 제거, 연속된 공백 단일 공백으로 변환\n          value = value.trim().replace(/\\s+/g, ' ');\n        }\n        \n        cleaned[key] = value;\n      });\n      \n      return cleaned;\n    }).filter(item => {\n      // 상호명이 비어있는 항목 제거\n      return item['상호명'] && item['상호명'].trim() !== '';\n    });\n  }\n}\n\nmodule.exports = new DataProcessor();