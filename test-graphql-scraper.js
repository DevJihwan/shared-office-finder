#!/usr/bin/env node

/**
 * GraphQL 스크래퍼 테스트 스크립트
 * 새로운 GraphQL API 스크래퍼의 동작을 테스트합니다.
 */

const NaverGraphQLScraper = require('./src/scrapers/naverGraphQLScraper');
const dataProcessor = require('./src/utils/dataProcessor');

// 테스트용 지역 설정 (서울 강남구만)
const testRegions = [
  {
    province: '서울특별시',
    districts: ['강남구']
  }
];

// 테스트용 키워드
const testKeywords = ['공유오피스'];

async function testGraphQLScraper() {
  console.log('🧪 GraphQL 스크래퍼 테스트 시작...\n');
  
  const scraper = new NaverGraphQLScraper();
  
  try {
    // 1. 단일 쿼리 테스트
    console.log('1️⃣ 단일 쿼리 테스트: "서울특별시 강남구 공유오피스"');
    const singleQueryData = await scraper.fetchAllDataForQuery(
      '서울특별시 강남구 공유오피스',
      (progress, status) => {
        console.log(`   진행률: ${Math.round(progress)}% - ${status}`);
      }
    );
    
    console.log(`   ✅ 수집 완료: ${singleQueryData.length}개\n`);
    
    if (singleQueryData.length > 0) {
      console.log('📋 샘플 데이터:');
      console.log('   상호명:', singleQueryData[0].name);
      console.log('   전화번호:', singleQueryData[0].phone || singleQueryData[0].virtualPhone);
      console.log('   주소:', singleQueryData[0].address);
      console.log('   도로명주소:', singleQueryData[0].roadAddress);
      console.log('');
    }
    
    // 2. 데이터 변환 테스트
    console.log('2️⃣ 데이터 변환 테스트');
    const transformedData = singleQueryData.map(item => 
      scraper.transformGraphQLItem(item, '서울특별시', '강남구', '공유오피스', '서울특별시 강남구 공유오피스')
    );
    
    console.log(`   ✅ 변환 완료: ${transformedData.length}개\n`);
    
    if (transformedData.length > 0) {
      console.log('📋 변환된 샘플 데이터:');
      console.log('   name:', transformedData[0].name);
      console.log('   tel:', transformedData[0].tel);
      console.log('   source:', transformedData[0].source);
      console.log('');
    }
    
    // 3. 데이터 처리 테스트
    console.log('3️⃣ 데이터 처리 테스트');
    const processedData = dataProcessor.processData(transformedData);
    
    console.log(`   ✅ 처리 완료: ${processedData.length}개\n`);
    
    if (processedData.length > 0) {
      console.log('📋 처리된 샘플 데이터:');
      console.log('   지역:', processedData[0]['지역']);
      console.log('   지역구:', processedData[0]['지역구']);
      console.log('   상호명:', processedData[0]['상호명']);
      console.log('   전화번호:', processedData[0]['전화번호']);
      console.log('   데이터소스:', processedData[0]['데이터소스']);
      console.log('');
    }
    
    // 4. 통합 기능 테스트 (가상의 기존 데이터와 통합)
    console.log('4️⃣ 데이터 통합 테스트');
    const mockExistingData = [
      { '상호명': '테스트 공유오피스', '전화번호': '02-1234-5678' }
    ];
    
    const integrationResult = dataProcessor.combineDataSources(mockExistingData, processedData);
    
    console.log(`   ✅ 통합 완료:`);
    console.log(`   - 기존: ${mockExistingData.length}개`);
    console.log(`   - 신규 추가: ${integrationResult.addedCount}개`);
    console.log(`   - 중복 제외: ${integrationResult.duplicateCount}개`);
    console.log(`   - 최종: ${integrationResult.combinedData.length}개\n`);
    
    console.log('🎉 GraphQL 스크래퍼 테스트 완료!\n');
    
    return {
      success: true,
      rawCount: singleQueryData.length,
      processedCount: processedData.length,
      integrationResult: integrationResult
    };
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error('상세 오류:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 스크립트가 직접 실행되는 경우에만 테스트 실행
if (require.main === module) {
  testGraphQLScraper()
    .then(result => {
      if (result.success) {
        console.log('✅ 모든 테스트가 성공적으로 완료되었습니다!');
        process.exit(0);
      } else {
        console.log('❌ 테스트가 실패했습니다.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ 예상치 못한 오류:', error);
      process.exit(1);
    });
}

module.exports = testGraphQLScraper;