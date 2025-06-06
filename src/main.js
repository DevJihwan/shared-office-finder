const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// 필요한 모듈들 import
const NaverMapScraper = require('./scrapers/naverMapScraper');
const NaverGraphQLScraper = require('./scrapers/naverGraphQLScraper');
const dataProcessor = require('./utils/dataProcessor');
const { regions, defaultKeywords, defaultSelectedRegions } = require('./config/regions');

// 기본 제외 키워드 목록
const defaultExcludeKeywords = [
  '비상주사무실소호사업자사무실공유오피스등록콜센터',
  '카페',
  '부동산',
  '공인중개사사무소',
  '창업센터',
  '파티룸',
  '연습실',
  '세미나',
  '패스트파이브'
];

let mainWindow;
let mapScraper;
let graphqlScraper;

// 사용자 설정 파일 경로
const userDataPath = app.getPath('userData');
const userSettingsPath = path.join(userDataPath, 'user-settings.json');

/**
 * 사용자 설정 로드
 */
function loadUserSettings() {
  try {
    if (fs.existsSync(userSettingsPath)) {
      const data = fs.readFileSync(userSettingsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('사용자 설정 로드 오류:', error);
  }
  return {
    removedDefaultKeywords: [],
    removedDefaultExcludeKeywords: [],
    selectedRegions: defaultSelectedRegions
  };
}

/**
 * 사용자 설정 저장
 */
function saveUserSettings(settings) {
  try {
    // userData 디렉토리가 없으면 생성
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    fs.writeFileSync(userSettingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('사용자 설정 저장 오류:', error);
    return false;
  }
}

/**
 * 메인 윈도우 생성
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: '공유오피스 데이터 수집기',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false, // 준비될 때까지 숨김
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  });

  // 메뉴 설정
  createMenu();

  // HTML 파일 로드 - 절대 경로 사용
  const htmlPath = path.join(__dirname, 'index.html');
  console.log('HTML 파일 경로:', htmlPath);
  console.log('HTML 파일 존재 여부:', fs.existsSync(htmlPath));
  
  mainWindow.loadFile(htmlPath);

  // 윈도우가 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('애플리케이션이 시작되었습니다.');
  });

  // 개발 모드에서 DevTools 자동 열기
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // 로드 실패 시 에러 처리
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('페이지 로드 실패:', errorCode, errorDescription, validatedURL);
  });

  // 윈도우 닫기 이벤트
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 애플리케이션 메뉴 생성
 */
function createMenu() {
  const template = [
    {
      label: '파일',
      submenu: [
        {
          label: '새로운 수집 시작',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-collection');
          }
        },
        {
          label: '결과 내보내기',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.send('menu-export');
          }
        },
        { type: 'separator' },
        {
          label: '기본 키워드 초기화',
          click: () => {
            resetDefaultKeywords();
          }
        },
        { type: 'separator' },
        {
          label: '종료',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '편집',
      submenu: [
        { label: '실행 취소', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '다시 실행', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '잘라내기', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '복사', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '붙여넣기', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '모두 선택', accelerator: 'CmdOrCtrl+A', role: 'selectall' }
      ]
    },
    {
      label: '보기',
      submenu: [
        { label: '다시 로드', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '강제 다시 로드', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: '개발자 도구', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '실제 크기', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '확대', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '축소', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '전체 화면', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '정보',
          click: () => {
            showAboutDialog();
          }
        },
        {
          label: 'GitHub에서 보기',
          click: () => {
            require('electron').shell.openExternal('https://github.com/DevJihwan/shared-office-finder');
          }
        }
      ]
    }
  ];

  // macOS에서 메뉴 조정
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { label: '정보', role: 'about' },
        { type: 'separator' },
        { label: '서비스', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: '숨기기', accelerator: 'Command+H', role: 'hide' },
        { label: '다른 것 숨기기', accelerator: 'Command+Alt+H', role: 'hideothers' },
        { label: '모두 보이기', role: 'unhide' },
        { type: 'separator' },
        { label: '종료', accelerator: 'Command+Q', click: () => app.quit() }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * 기본 키워드 초기화 (메뉴에서 사용)
 */
function resetDefaultKeywords() {
  const result = dialog.showMessageBoxSync(mainWindow, {
    type: 'question',
    buttons: ['초기화', '취소'],
    defaultId: 1,
    title: '기본 키워드 초기화',
    message: '기본 키워드를 초기 상태로 되돌리시겠습니까?',
    detail: '삭제했던 기본 키워드들이 다시 나타납니다.'
  });
  
  if (result === 0) {
    // 사용자 설정 초기화
    const settings = loadUserSettings();
    settings.removedDefaultKeywords = [];
    settings.removedDefaultExcludeKeywords = [];
    saveUserSettings(settings);
    
    // 화면에 메시지 전송
    mainWindow.webContents.send('reset-default-keywords');
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '완료',
      message: '기본 키워드가 초기화되었습니다.',
      detail: '프로그램을 다시 시작하면 모든 기본 키워드가 복원됩니다.'
    });
  }
}

/**
 * 정보 대화상자 표시
 */
function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '공유오피스 데이터 수집기 정보',
    message: '공유오피스 데이터 수집기',
    detail: `버전: 1.0.0\\n개발자: DataLink-Studio\\n\\n네이버 지도 API를 활용하여 전국의 공유오피스, 코워킹스페이스 정보를 수집하는 프로그램입니다.`,
    buttons: ['확인']
  });
}

/**
 * 로그 메시지를 렌더러 프로세스로 전송
 */
function sendLogMessage(type, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log-message', { type, message });
  }
}

/**
 * 진행 상황을 렌더러 프로세스로 전송
 */
function sendProgress(progress, status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('progress-update', { progress, status });
  }
}

/**
 * 수집 통계 계산
 */
function calculateStatistics(data, excludedCount = 0, graphqlAddedCount = 0, graphqlDuplicateCount = 0) {
  const stats = {
    totalCount: data.length,
    withPhoneNumber: data.filter(item => item['전화번호'] && item['전화번호'].trim()).length,
    withWebsite: data.filter(item => item['홈페이지'] && item['홈페이지'].trim()).length,
    excludedCount: excludedCount,
    graphqlAddedCount: graphqlAddedCount,
    graphqlDuplicateCount: graphqlDuplicateCount,
    regionStats: {},
    sourceStats: {
      naver_map: data.filter(item => (item['데이터소스'] || 'naver_map') === 'naver_map').length,
      graphql: data.filter(item => item['데이터소스'] === 'graphql').length
    }
  };

  // 지역별 통계 (지역 + 지역구 조합으로 계산)
  data.forEach(item => {
    const region = item['지역'] || 'Unknown';
    const district = item['지역구'] || '';
    const fullRegion = district ? `${region} ${district}` : region;
    
    if (!stats.regionStats[fullRegion]) {
      stats.regionStats[fullRegion] = 0;
    }
    stats.regionStats[fullRegion]++;
  });

  return stats;
}

// Electron 앱 이벤트 처리
app.whenReady().then(() => {
  createWindow();
  
  // Scraper 인스턴스 생성
  mapScraper = new NaverMapScraper();
  graphqlScraper = new NaverGraphQLScraper();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 핸들러들

/**
 * 전체 지역 목록 반환
 */
ipcMain.handle('get-regions', async () => {
  try {
    return regions;
  } catch (error) {
    console.error(`지역 목록 로드 오류: ${error.message}`);
    return [];
  }
});

/**
 * 사용자가 선택한 지역 목록 반환
 */
ipcMain.handle('get-selected-regions', async () => {
  try {
    const userSettings = loadUserSettings();
    return userSettings.selectedRegions || defaultSelectedRegions;
  } catch (error) {
    console.error(`선택된 지역 로드 오류: ${error.message}`);
    return defaultSelectedRegions;
  }
});

/**
 * 사용자가 선택한 지역 목록 저장
 */
ipcMain.handle('save-selected-regions', async (event, selectedRegions) => {
  try {
    const userSettings = loadUserSettings();
    userSettings.selectedRegions = selectedRegions;
    const success = saveUserSettings(userSettings);
    
    if (success) {
      console.log('선택된 지역이 저장되었습니다:', selectedRegions);
      return { success: true };
    } else {
      return { success: false, error: '설정 저장 실패' };
    }
  } catch (error) {
    console.error(`선택된 지역 저장 오류: ${error.message}`);
    return { success: false, error: error.message };
  }
});

/**
 * 기본 키워드 반환 (사용자가 삭제한 키워드 제외)
 */
ipcMain.handle('get-default-keywords', async () => {
  try {
    const userSettings = loadUserSettings();
    const removedKeywords = userSettings.removedDefaultKeywords || [];
    
    // 삭제된 키워드들을 제외한 기본 키워드만 반환
    const filteredKeywords = defaultKeywords.filter(
      keyword => !removedKeywords.includes(keyword)
    );
    
    console.log('로드된 기본 키워드:', filteredKeywords);
    console.log('제외된 키워드:', removedKeywords);
    
    return filteredKeywords;
  } catch (error) {
    console.error(`기본 키워드 로드 오류: ${error.message}`);
    return ['공유오피스', '코워킹스페이스'];
  }
});

/**
 * 기본 제외 키워드 반환 (사용자가 삭제한 키워드 제외)
 */
ipcMain.handle('get-default-exclude-keywords', async () => {
  try {
    const userSettings = loadUserSettings();
    const removedKeywords = userSettings.removedDefaultExcludeKeywords || [];
    
    // 삭제된 키워드들을 제외한 기본 제외 키워드만 반환
    const filteredKeywords = defaultExcludeKeywords.filter(
      keyword => !removedKeywords.includes(keyword)
    );
    
    console.log('로드된 기본 제외 키워드:', filteredKeywords);
    console.log('제외된 제외 키워드:', removedKeywords);
    
    return filteredKeywords;
  } catch (error) {
    console.error(`기본 제외 키워드 로드 오류: ${error.message}`);
    return ['카페', '부동산'];
  }
});

/**
 * 기본 키워드를 사용자의 삭제 목록에 추가
 */
ipcMain.handle('remove-default-keyword', async (event, keyword) => {
  try {
    const userSettings = loadUserSettings();
    
    // 기본 키워드인지 확인
    if (defaultKeywords.includes(keyword)) {
      if (!userSettings.removedDefaultKeywords) {
        userSettings.removedDefaultKeywords = [];
      }
      
      if (!userSettings.removedDefaultKeywords.includes(keyword)) {
        userSettings.removedDefaultKeywords.push(keyword);
        const success = saveUserSettings(userSettings);
        
        if (success) {
          console.log(`기본 키워드 \"${keyword}\"가 삭제 목록에 추가되었습니다.`);
          return { success: true };
        } else {
          return { success: false, error: '설정 저장 실패' };
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error(`기본 키워드 삭제 처리 오류: ${error.message}`);
    return { success: false, error: error.message };
  }
});

/**
 * 기본 제외 키워드를 사용자의 삭제 목록에 추가
 */
ipcMain.handle('remove-default-exclude-keyword', async (event, keyword) => {
  try {
    const userSettings = loadUserSettings();
    
    // 기본 제외 키워드인지 확인
    if (defaultExcludeKeywords.includes(keyword)) {
      if (!userSettings.removedDefaultExcludeKeywords) {
        userSettings.removedDefaultExcludeKeywords = [];
      }
      
      if (!userSettings.removedDefaultExcludeKeywords.includes(keyword)) {
        userSettings.removedDefaultExcludeKeywords.push(keyword);
        const success = saveUserSettings(userSettings);
        
        if (success) {
          console.log(`기본 제외 키워드 \"${keyword}\"가 삭제 목록에 추가되었습니다.`);
          return { success: true };
        } else {
          return { success: false, error: '설정 저장 실패' };
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error(`기본 제외 키워드 삭제 처리 오류: ${error.message}`);
    return { success: false, error: error.message };
  }
});

/**
 * 데이터 수집 시작 (두 스크래퍼 통합)
 */
ipcMain.handle('start-scraping', async (event, keywords, excludeKeywords = [], selectedRegionNames = []) => {
  try {
    sendLogMessage('info', `통합 데이터 수집을 시작합니다. 키워드: ${keywords.join(', ')}`);
    if (excludeKeywords.length > 0) {
      sendLogMessage('info', `제외 키워드: ${excludeKeywords.join(', ')}`);
    }
    
    // 선택된 지역만 필터링
    let targetRegions = regions;
    if (selectedRegionNames && selectedRegionNames.length > 0) {
      targetRegions = regions.filter(region => selectedRegionNames.includes(region.province));
      sendLogMessage('info', `선택된 지역: ${selectedRegionNames.join(', ')}`);
    } else {
      sendLogMessage('warning', '선택된 지역이 없습니다. 전체 지역에서 수집합니다.');
    }
    
    sendProgress(0, '데이터 수집 준비 중...');

    // 1단계: 기본 네이버 지도 API로 데이터 수집
    sendLogMessage('info', '1단계: 네이버 지도 API 데이터 수집 시작...');
    const mapRawData = await mapScraper.collectAllData(
      targetRegions,
      keywords,
      (progress, status) => {
        sendProgress(progress * 0.4, `[지도 API] ${status}`); // 전체의 40%
      },
      (type, message) => {
        sendLogMessage(type, `[지도 API] ${message}`);
      }
    );

    sendLogMessage('info', `지도 API 원본 데이터 수집 완료: ${mapRawData.length}개`);

    // 2단계: GraphQL API로 추가 데이터 수집
    sendLogMessage('info', '2단계: GraphQL API 데이터 수집 시작...');
    const graphqlRawData = await graphqlScraper.collectAllData(
      targetRegions,
      keywords,
      (progress, status) => {
        sendProgress(40 + (progress * 0.4), `[GraphQL API] ${status}`); // 40%~80%
      },
      (type, message) => {
        sendLogMessage(type, `[GraphQL API] ${message}`);
      }
    );

    sendLogMessage('info', `GraphQL API 원본 데이터 수집 완료: ${graphqlRawData.length}개`);

    if (mapRawData.length === 0 && graphqlRawData.length === 0) {
      throw new Error('두 API 모두에서 수집된 데이터가 없습니다.');
    }

    sendProgress(80, '데이터 처리 및 통합 중...');
    sendLogMessage('info', '3단계: 데이터 처리 및 통합 시작...');

    // 각각 데이터 처리
    const processedMapData = dataProcessor.processData(mapRawData);
    const processedGraphqlData = dataProcessor.processData(graphqlRawData);
    
    sendLogMessage('info', `처리된 지도 API 데이터: ${processedMapData.length}개`);
    sendLogMessage('info', `처리된 GraphQL API 데이터: ${processedGraphqlData.length}개`);

    // 데이터 통합 (상호명 기준 중복 제거)
    const integrationResult = dataProcessor.combineDataSources(processedMapData, processedGraphqlData);
    const combinedData = integrationResult.combinedData;
    const graphqlAddedCount = integrationResult.addedCount;
    const graphqlDuplicateCount = integrationResult.duplicateCount;

    sendLogMessage('success', `데이터 통합 완료: 기존 ${processedMapData.length}개 + 신규 ${graphqlAddedCount}개 = 총 ${combinedData.length}개`);
    sendLogMessage('info', `GraphQL에서 중복으로 제외된 데이터: ${graphqlDuplicateCount}개`);

    // 전체 데이터 중복 제거
    const deduplicatedData = dataProcessor.deduplicateData(combinedData);
    sendLogMessage('info', `최종 중복 제거 완료: ${deduplicatedData.length}개`);

    // 제외 키워드 필터링 적용
    const { filteredData, excludedCount } = dataProcessor.filterByExcludeKeywords(deduplicatedData, excludeKeywords);
    sendLogMessage('info', `제외 키워드 필터링 완료: ${filteredData.length}개 (제외: ${excludedCount}개)`);

    const cleanedData = dataProcessor.cleanData(filteredData);
    sendLogMessage('info', `데이터 정리 완료: ${cleanedData.length}개`);

    // 데이터 검증
    if (cleanedData.length === 0) {
      throw new Error('데이터 처리 후 유효한 데이터가 없습니다.');
    }

    // 통계 계산 (GraphQL 통합 정보 포함)
    const statistics = calculateStatistics(cleanedData, excludedCount, graphqlAddedCount, graphqlDuplicateCount);

    sendProgress(100, '통합 데이터 수집 완료!');
    sendLogMessage('success', `통합 데이터 수집이 완료되었습니다!`);
    sendLogMessage('success', `- 지도 API: ${statistics.sourceStats.naver_map}개`);
    sendLogMessage('success', `- GraphQL API: ${statistics.sourceStats.graphql}개`);
    sendLogMessage('success', `- 총 수집: ${cleanedData.length}개`);

    return {
      success: true,
      data: cleanedData,
      count: cleanedData.length,
      statistics: statistics
    };

  } catch (error) {
    console.error(`통합 데이터 수집 오류: ${error.message}`);
    console.error('Error stack:', error.stack);
    sendLogMessage('error', `통합 데이터 수집 실패: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * 데이터 저장
 */
ipcMain.handle('save-data', async (event, data, filePath) => {
  try {
    sendLogMessage('info', `데이터를 저장 중입니다: ${filePath}`);
    console.log(`저장할 데이터 개수: ${data.length}`);
    console.log('저장할 데이터 샘플:', data.slice(0, 2));

    // 데이터 유효성 검사
    const validation = dataProcessor.validateData(data);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // 파일 저장
    dataProcessor.saveData(data, filePath);

    sendLogMessage('success', `데이터가 성공적으로 저장되었습니다: ${filePath}`);
    return { success: true };

  } catch (error) {
    console.error(`데이터 저장 오류: ${error.message}`);
    console.error('Error stack:', error.stack);
    sendLogMessage('error', `데이터 저장 실패: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * 파일 저장 대화상자 표시
 */
ipcMain.handle('show-save-dialog', async (event, options = {}) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '데이터 저장',
      defaultPath: options.defaultPath || '공유오피스_데이터.xlsx',
      filters: [
        { name: 'Excel Files', extensions: ['xlsx'] },
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      ...options
    });
    
    return result;
    
  } catch (error) {
    console.error(`저장 대화상자 오류: ${error.message}`);
    return { canceled: true };
  }
});

/**
 * 애플리케이션 정보 반환
 */
ipcMain.handle('get-app-info', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch
  };
});

module.exports = {
  sendLogMessage,
  sendProgress
};