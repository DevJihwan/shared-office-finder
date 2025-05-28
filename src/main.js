const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// 필요한 모듈들 import
const NaverMapScraper = require('./scrapers/naverMapScraper');
const dataProcessor = require('./utils/dataProcessor');
const { regions, defaultKeywords } = require('./config/regions');

let mainWindow;
let scraper;

/**
 * 메인 윈도우 생성
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false, // 준비될 때까지 숨김
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  });

  // 메뉴 설정
  createMenu();

  // HTML 파일 로드
  mainWindow.loadFile('index.html');

  // 윈도우가 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('애플리케이션이 시작되었습니다.');
  });

  // 개발 모드에서 DevTools 자동 열기
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

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
 * 정보 대화상자 표시
 */
function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '공유오피스 데이터 수집기 정보',
    message: '공유오피스 데이터 수집기',
    detail: `버전: 1.0.0\n개발자: DataLink-Studio\n\n네이버 지도 API를 활용하여 전국의 공유오피스, 코워킹스페이스 정보를 수집하는 프로그램입니다.`,
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
function calculateStatistics(data) {
  const stats = {
    totalCount: data.length,
    withPhoneNumber: data.filter(item => item['전화번호'] && item['전화번호'].trim()).length,
    withWebsite: data.filter(item => item['홈페이지'] && item['홈페이지'].trim()).length,
    regionStats: {}
  };

  // 지역별 통계
  data.forEach(item => {
    const region = item['지역'] || 'Unknown';
    if (!stats.regionStats[region]) {
      stats.regionStats[region] = 0;
    }
    stats.regionStats[region]++;
  });

  return stats;
}

// Electron 앱 이벤트 처리
app.whenReady().then(() => {
  createWindow();
  
  // Scraper 인스턴스 생성
  scraper = new NaverMapScraper();
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
 * 기본 키워드 반환
 */
ipcMain.handle('get-default-keywords', async () => {
  try {
    return defaultKeywords;
  } catch (error) {
    console.error(`기본 키워드 로드 오류: ${error.message}`);
    return ['공유오피스', '코워킹스페이스'];
  }
});

/**
 * 데이터 수집 시작
 */
ipcMain.handle('start-scraping', async (event, keywords) => {
  try {
    sendLogMessage('info', `데이터 수집을 시작합니다. 키워드: ${keywords.join(', ')}`);
    sendProgress(0, '데이터 수집 준비 중...');

    // 모든 데이터 수집
    const rawData = await scraper.collectAllData(
      regions,
      keywords,
      (progress, status) => {
        sendProgress(progress, status);
      },
      (type, message) => {
        sendLogMessage(type, message);
      }
    );

    sendLogMessage('info', `원본 데이터 수집 완료: ${rawData.length}개`);
    console.log('Raw data sample:', rawData.slice(0, 2)); // 디버깅용

    if (rawData.length === 0) {
      throw new Error('수집된 데이터가 없습니다.');
    }

    sendLogMessage('info', '데이터 정제 중...');
    sendProgress(95, '데이터 정제 중...');

    // 데이터 정제 및 처리
    const processedData = dataProcessor.processData(rawData);
    sendLogMessage('info', `데이터 처리 완료: ${processedData.length}개`);
    console.log('Processed data sample:', processedData.slice(0, 2)); // 디버깅용

    const deduplicatedData = dataProcessor.deduplicateData(processedData);
    sendLogMessage('info', `중복 제거 완료: ${deduplicatedData.length}개`);
    console.log('Deduplicated data sample:', deduplicatedData.slice(0, 2)); // 디버깅용

    const cleanedData = dataProcessor.cleanData(deduplicatedData);
    sendLogMessage('info', `데이터 정리 완료: ${cleanedData.length}개`);
    console.log('Cleaned data sample:', cleanedData.slice(0, 2)); // 디버깅용

    // 데이터 검증
    if (cleanedData.length === 0) {
      throw new Error('데이터 처리 후 유효한 데이터가 없습니다.');
    }

    // 통계 계산
    const statistics = calculateStatistics(cleanedData);

    sendProgress(100, '데이터 수집 완료!');
    sendLogMessage('success', `데이터 수집이 완료되었습니다. 총 ${cleanedData.length}개의 데이터를 수집했습니다.`);

    return {
      success: true,
      data: cleanedData,
      count: cleanedData.length,
      statistics: statistics
    };

  } catch (error) {
    console.error(`데이터 수집 오류: ${error.message}`);
    console.error('Error stack:', error.stack);
    sendLogMessage('error', `데이터 수집 실패: ${error.message}`);
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