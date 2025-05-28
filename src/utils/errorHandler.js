class ErrorHandler {
  constructor() {
    this.errorTypes = {
      NETWORK_ERROR: 'NETWORK_ERROR',
      API_ERROR: 'API_ERROR',
      FILE_ERROR: 'FILE_ERROR',
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      UNKNOWN_ERROR: 'UNKNOWN_ERROR'
    };
  }

  /**
   * 에러 타입 분류
   * @param {Error} error - 에러 객체
   * @returns {string} - 에러 타입
   */
  classifyError(error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return this.errorTypes.NETWORK_ERROR;
    }
    
    if (error.response && error.response.status) {
      return this.errorTypes.API_ERROR;
    }
    
    if (error.code && error.code.startsWith('E')) {
      return this.errorTypes.FILE_ERROR;
    }
    
    if (error.name === 'ValidationError') {
      return this.errorTypes.VALIDATION_ERROR;
    }
    
    return this.errorTypes.UNKNOWN_ERROR;
  }

  /**
   * 사용자 친화적 에러 메시지 생성
   * @param {Error} error - 에러 객체
   * @returns {string} - 사용자 메시지
   */
  getUserFriendlyMessage(error) {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case this.errorTypes.NETWORK_ERROR:
        return '네트워크 연결을 확인해주세요. 인터넷 연결이 불안정할 수 있습니다.';
      
      case this.errorTypes.API_ERROR:
        if (error.response?.status === 503) {
          return '서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.';
        }
        if (error.response?.status === 429) {
          return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        }
        return '서버에서 데이터를 가져오는 중 오류가 발생했습니다.';
      
      case this.errorTypes.FILE_ERROR:
        return '파일 저장 중 오류가 발생했습니다. 저장 경로와 권한을 확인해주세요.';
      
      case this.errorTypes.VALIDATION_ERROR:
        return '입력된 데이터가 올바르지 않습니다. 다시 확인해주세요.';
      
      default:
        return '예상치 못한 오류가 발생했습니다. 문제가 지속되면 개발자에게 문의해주세요.';
    }
  }

  /**
   * 에러 처리 및 로깅
   * @param {Error} error - 에러 객체
   * @param {string} context - 에러 발생 컨텍스트
   * @returns {Object} - 처리된 에러 정보
   */
  handleError(error, context = 'Unknown') {
    const errorType = this.classifyError(error);
    const userMessage = this.getUserFriendlyMessage(error);
    
    // 에러 로깅
    console.error(`[${context}] ${errorType}: ${error.message}`);
    
    if (error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }
    
    return {
      type: errorType,
      userMessage,
      technicalMessage: error.message,
      context,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 재시도 로직 구현
   * @param {Function} fn - 재시도할 함수
   * @param {number} maxRetries - 최대 재시도 횟수
   * @param {number} delay - 재시도 간격 (ms)
   * @returns {Promise} - 함수 실행 결과
   */
  async withRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw this.handleError(error, 'Retry exhausted');
        }
        
        const errorType = this.classifyError(error);
        
        // 네트워크 에러나 503 에러의 경우에만 재시도
        if (errorType === this.errorTypes.NETWORK_ERROR || 
            (error.response?.status === 503)) {
          
          console.warn(`재시도 중... (${attempt}/${maxRetries}) - ${delay}ms 대기`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw this.handleError(error, 'Non-retryable error');
        }
      }
    }
  }

  /**
   * 전역 에러 핸들러 설정
   */
  setupGlobalHandlers() {
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      // 프로세스 종료 방지 (개발 환경에서만)
      if (process.env.NODE_ENV !== 'production') {
        console.error('Uncaught Exception (prevented exit):', error);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  /**
   * 에러 상세 정보 생성
   * @param {Error} error - 에러 객체
   * @returns {Object} - 상세 에러 정보
   */
  getErrorDetails(error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js'
    };
  }

  /**
   * 에러 복구 시도
   * @param {Error} error - 에러 객체
   * @param {Object} options - 복구 옵션
   * @returns {boolean} - 복구 성공 여부
   */
  attemptRecovery(error, options = {}) {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case this.errorTypes.NETWORK_ERROR:
        // 네트워크 에러의 경우 잠시 대기 후 재시도 권장
        console.log('네트워크 오류 감지. 재시도를 권장합니다.');
        return false;
        
      case this.errorTypes.API_ERROR:
        if (error.response?.status === 503) {
          console.log('서버 과부하 감지. 잠시 후 재시도하세요.');
          return false;
        }
        break;
        
      case this.errorTypes.FILE_ERROR:
        // 파일 에러의 경우 다른 경로 시도
        if (options.alternativePath) {
          console.log('대체 파일 경로로 시도합니다.');
          return true;
        }
        break;
    }
    
    return false;
  }
}

module.exports = new ErrorHandler();