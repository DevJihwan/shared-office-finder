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
   * 데이터 정제 및 표준화
   * @param {Array} rawData - 원본 데이터
   * @returns {Array} - 정제된 데이터
   */
  processData(rawData) {
    console.log('Processing data, sample item:', rawData[0]);
    
    return rawData.map(item => {
      // 네이버 지도 API 응답 구조에 맞게 필드 매핑
      let region = "";
      
      // 지역 정보 추출 (우선순위: province > shortAddress > address 파싱)
      if (item.province && item.district) {
        region = `${item.province} ${item.district}`;
      } else if (item.shortAddress && item.shortAddress.length > 0) {
        region = item.shortAddress[0];
      } else if (item.roadAddress) {
        // 도로명주소에서 지역 추출
        const addressParts = item.roadAddress.split(' ');
        if (addressParts.length >= 2) {
          region = `${addressParts[0]} ${addressParts[1]}`;
        }
      } else if (item.address) {
        // 지번주소에서 지역 추출
        const addressParts = item.address.split(' ');
        if (addressParts.length >= 2) {
          region = `${addressParts[0]} ${addressParts[1]}`;
        }
      }

      return {
        "지역": region || '미분류',
        "키워드": item.keyword || item.searchKeyword || '',
        "상호명": item.name || item.title || '',
        "전화번호": this.formatPhoneNumber(item.tel || item.phone),
        "지번주소": item.address || '',
        "도로명주소": item.roadAddress || item.road_address || '',
        "가격정보": this.extractPriceInfo(item.menuInfo || item.description),
        "홈페이지": item.homePage || item.homepage || item.url || '',
        "카테고리": item.category || item.bizhourInfo || '',
        "평점": item.ratings || item.rating || '',
        "리뷰수": item.reviewCount || '',
        "영업시간": this.formatBusinessHours(item.bizhourInfo),
        "수집일시": new Date().toISOString().split('T')[0],
        "검색쿼리": item.searchQuery || ''
      };
    });
  }

  /**
   * 전화번호 포맷팅
   * @param {string} tel - 원본 전화번호
   * @returns {string} - 포맷팅된 전화번호
   */
  formatPhoneNumber(tel) {
    if (!tel) return '';
    
    // 숫자만 추출
    const numbers = tel.replace(/[^0-9]/g, '');
    
    if (numbers.length === 0) return '';
    
    // 일반적인 전화번호 형식으로 변환
    if (numbers.length === 11 && numbers.startsWith('010')) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    } else if (numbers.length === 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
    } else if (numbers.length === 8) {
      return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
    } else if (numbers.length === 9) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;
    }
    
    return tel;
  }

  /**
   * 영업시간 정보 포맷팅
   * @param {string} bizhourInfo - 영업시간 정보
   * @returns {string} - 포맷팅된 영업시간
   */
  formatBusinessHours(bizhourInfo) {
    if (!bizhourInfo) return '';
    
    // 줄바꿈을 공백으로 변경하고 길이 제한
    return bizhourInfo.replace(/\n/g, ' ').slice(0, 100);
  }

  /**
   * 가격 정보 추출
   * @param {string} menuInfo - 메뉴 정보
   * @returns {string} - 정제된 가격 정보
   */
  extractPriceInfo(menuInfo) {
    if (!menuInfo) return '';
    
    // 가격 관련 키워드가 포함된 텍스트만 추출
    const priceKeywords = ['원', '₩', '만원', '시간', '일', '월', '년', '무료', '할인'];
    const lines = menuInfo.split('\n').filter(line => 
      priceKeywords.some(keyword => line.includes(keyword))
    );
    
    return lines.join(' | ').slice(0, 200); // 200자 제한
  }

  /**
   * Excel 파일로 저장
   * @param {Array} data - 저장할 데이터
   * @param {string} filePath - 저장 경로
   */
  saveToExcel(data, filePath) {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // 컬럼 너비 설정
      const columnWidths = [
        { wch: 15 }, // 지역
        { wch: 15 }, // 키워드
        { wch: 25 }, // 상호명
        { wch: 15 }, // 전화번호
        { wch: 40 }, // 지번주소
        { wch: 40 }, // 도로명주소
        { wch: 30 }, // 가격정보
        { wch: 30 }, // 홈페이지
        { wch: 15 }, // 카테고리
        { wch: 10 }, // 평점
        { wch: 10 }, // 리뷰수
        { wch: 25 }, // 영업시간
        { wch: 12 }, // 수집일시
        { wch: 25 }  // 검색쿼리
      ];
      worksheet['!cols'] = columnWidths;
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '공유오피스 데이터');
      XLSX.writeFile(workbook, filePath);
      
      console.log(`Excel 파일 저장 완료: ${filePath}`);
    } catch (error) {
      console.error(`Excel 파일 저장 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * JSON 파일로 저장
   * @param {Array} data - 저장할 데이터
   * @param {string} filePath - 저장 경로
   */
  saveToJson(data, filePath) {
    try {
      const jsonData = {
        metadata: {
          exportDate: new Date().toISOString(),
          totalCount: data.length,
          version: '1.0.0'
        },
        data: data
      };
      
      fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
      console.log(`JSON 파일 저장 완료: ${filePath}`);
    } catch (error) {
      console.error(`JSON 파일 저장 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 파일 확장자에 따른 자동 저장
   * @param {Array} data - 저장할 데이터
   * @param {string} filePath - 저장 경로
   */
  saveData(data, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.xlsx') {
      this.saveToExcel(data, filePath);
    } else if (ext === '.json') {
      this.saveToJson(data, filePath);
    } else {
      throw new Error('지원하지 않는 파일 형식입니다. .xlsx 또는 .json 파일만 지원됩니다.');
    }
  }

  /**
   * 데이터 유효성 검사
   * @param {Array} data - 검사할 데이터
   * @returns {Object} - 검사 결과
   */
  validateData(data) {
    if (!Array.isArray(data)) {
      return { valid: false, message: '데이터가 배열 형식이 아닙니다.' };
    }

    if (data.length === 0) {
      return { valid: false, message: '데이터가 비어있습니다.' };
    }

    const requiredFields = ['상호명'];
    const missingFieldsItems = data.filter(item => 
      requiredFields.some(field => !item[field] || item[field].trim() === '')
    );

    if (missingFieldsItems.length > 0) {
      console.log('Missing fields items sample:', missingFieldsItems.slice(0, 3));
      return { 
        valid: false, 
        message: `${missingFieldsItems.length}개 항목에 필수 필드(상호명)가 누락되었습니다.` 
      };
    }

    return { valid: true, message: '데이터가 유효합니다.' };
  }

  /**
   * 데이터 정리 및 정규화
   * @param {Array} data - 정리할 데이터
   * @returns {Array} - 정리된 데이터
   */
  cleanData(data) {
    return data.map(item => {
      const cleaned = {};
      
      // 각 필드 정리
      Object.keys(item).forEach(key => {
        let value = item[key];
        
        if (typeof value === 'string') {
          // 문자열 정리: 앞뒤 공백 제거, 연속된 공백 단일 공백으로 변환
          value = value.trim().replace(/\s+/g, ' ');
        }
        
        cleaned[key] = value;
      });
      
      return cleaned;
    }).filter(item => {
      // 상호명이 비어있는 항목 제거
      return item['상호명'] && item['상호명'].trim() !== '';
    });
  }
}

module.exports = new DataProcessor();