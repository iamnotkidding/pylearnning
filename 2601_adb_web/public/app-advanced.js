// WebADB 자동 설치 서비스 - 고급 버전 (@yume-chan/adb 라이브러리 사용)
// 이 파일은 실제 ADB 프로토콜을 완전히 구현한 버전입니다.

import AdbWebUsbBackend from 'https://cdn.jsdelivr.net/npm/@yume-chan/adb-backend-webusb@0.0.24/+esm';
import { Adb, AdbSync } from 'https://cdn.jsdelivr.net/npm/@yume-chan/adb@0.0.24/+esm';

// 전역 변수
let adb = null;
let device = null;

// APK URL - 실제 서버 경로로 변경 필요
const APK_URL = '/path/to/your/app.apk';

// UI 요소
const elements = {
    connectionStatus: document.getElementById('connectionStatus'),
    deviceInfo: document.getElementById('deviceInfo'),
    installStatus: document.getElementById('installStatus'),
    connectBtn: document.getElementById('connectBtn'),
    installBtn: document.getElementById('installBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    logContainer: document.getElementById('logContainer'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill')
};

// 로그 출력
function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    const timestamp = new Date().toLocaleTimeString('ko-KR');
    logEntry.textContent = `[${timestamp}] ${message}`;
    elements.logContainer.appendChild(logEntry);
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

// 진행률 업데이트
function updateProgress(percent) {
    elements.progressBar.style.display = 'block';
    elements.progressFill.style.width = `${percent}%`;
    if (percent >= 100) {
        setTimeout(() => {
            elements.progressBar.style.display = 'none';
            elements.progressFill.style.width = '0%';
        }, 1000);
    }
}

// UI 상태 업데이트
function updateConnectionStatus(connected, deviceName = '-') {
    if (connected) {
        elements.connectionStatus.textContent = '연결됨';
        elements.connectionStatus.className = 'status-value status-connected';
        elements.deviceInfo.textContent = deviceName;
        elements.connectBtn.disabled = true;
        elements.installBtn.disabled = false;
        elements.disconnectBtn.disabled = false;
    } else {
        elements.connectionStatus.textContent = '연결 안됨';
        elements.connectionStatus.className = 'status-value status-disconnected';
        elements.deviceInfo.textContent = '-';
        elements.connectBtn.disabled = false;
        elements.installBtn.disabled = true;
        elements.disconnectBtn.disabled = true;
    }
}

// 기기 연결
async function connectDevice() {
    try {
        addLog('기기 선택 대화상자를 표시합니다...', 'info');
        
        // WebUSB 기기 선택
        const devices = await AdbWebUsbBackend.requestDevice();
        
        if (!devices || devices.length === 0) {
            throw new Error('선택된 기기가 없습니다.');
        }

        device = devices[0];
        addLog('USB 기기를 선택했습니다. ADB 연결 중...', 'info');

        // ADB 연결 생성
        adb = await device.connect();

        // 기기 정보 가져오기
        const properties = await getDeviceProperties();
        const deviceName = `${properties.manufacturer} ${properties.model}`.trim() || 'Unknown Device';
        const androidVersion = properties.version || 'Unknown';

        addLog(`기기 연결 성공!`, 'success');
        addLog(`모델: ${deviceName}`, 'info');
        addLog(`안드로이드 버전: ${androidVersion}`, 'info');
        
        updateConnectionStatus(true, deviceName);
        elements.installStatus.textContent = '설치 준비 완료';

    } catch (error) {
        addLog(`연결 실패: ${error.message}`, 'error');
        console.error('Connection error:', error);
    }
}

// 기기 속성 가져오기
async function getDeviceProperties() {
    try {
        const props = {};
        
        // 제조사
        const manufacturerResult = await adb.subprocess.shell('getprop ro.product.manufacturer');
        props.manufacturer = await readStream(manufacturerResult.stdout);
        
        // 모델명
        const modelResult = await adb.subprocess.shell('getprop ro.product.model');
        props.model = await readStream(modelResult.stdout);
        
        // 안드로이드 버전
        const versionResult = await adb.subprocess.shell('getprop ro.build.version.release');
        props.version = await readStream(versionResult.stdout);
        
        return props;
    } catch (error) {
        console.error('Error getting properties:', error);
        return {};
    }
}

// 스트림 읽기 헬퍼
async function readStream(stream) {
    const reader = stream.getReader();
    const chunks = [];
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    
    const uint8Array = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        uint8Array.set(chunk, offset);
        offset += chunk.length;
    }
    
    return new TextDecoder().decode(uint8Array).trim();
}

// APK 설치
async function installApp() {
    if (!adb) {
        addLog('먼저 기기를 연결해주세요.', 'warning');
        return;
    }

    try {
        elements.installStatus.textContent = '설치 중...';
        elements.installStatus.className = 'status-value status-installing';
        elements.installBtn.disabled = true;

        addLog('서버에서 APK 다운로드 중...', 'info');
        updateProgress(10);

        // APK 다운로드
        const response = await fetch(APK_URL);
        if (!response.ok) {
            throw new Error(`APK 다운로드 실패: ${response.status} ${response.statusText}`);
        }

        const totalSize = parseInt(response.headers.get('content-length') || '0');
        const reader = response.body.getReader();
        const chunks = [];
        let receivedSize = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            receivedSize += value.length;
            
            if (totalSize > 0) {
                const downloadProgress = 10 + (receivedSize / totalSize * 30);
                updateProgress(downloadProgress);
            }
        }

        const apkData = new Uint8Array(receivedSize);
        let position = 0;
        for (const chunk of chunks) {
            apkData.set(chunk, position);
            position += chunk.length;
        }

        addLog(`APK 다운로드 완료 (${(receivedSize / 1024 / 1024).toFixed(2)} MB)`, 'success');
        updateProgress(40);

        // APK를 기기로 전송
        addLog('기기에 APK 전송 중...', 'info');
        const remotePath = '/data/local/tmp/temp_app.apk';
        
        const sync = await adb.sync();
        await sync.write(remotePath, apkData, (progress) => {
            const transferProgress = 40 + (progress * 30);
            updateProgress(transferProgress);
        });

        addLog('APK 전송 완료', 'success');
        updateProgress(70);

        // APK 설치
        addLog('패키지 설치 중...', 'info');
        const installResult = await adb.subprocess.shell(`pm install -r ${remotePath}`);
        const installOutput = await readStream(installResult.stdout);
        
        updateProgress(90);

        // 임시 파일 삭제
        await adb.subprocess.shell(`rm ${remotePath}`);

        if (installOutput.includes('Success')) {
            addLog('앱 설치가 완료되었습니다!', 'success');
            elements.installStatus.textContent = '설치 완료';
            elements.installStatus.className = 'status-value status-connected';
            updateProgress(100);
        } else {
            throw new Error(`설치 실패: ${installOutput}`);
        }

    } catch (error) {
        addLog(`설치 실패: ${error.message}`, 'error');
        elements.installStatus.textContent = '설치 실패';
        elements.installStatus.className = 'status-value status-disconnected';
        updateProgress(0);
        console.error('Installation error:', error);
    } finally {
        elements.installBtn.disabled = false;
    }
}

// 연결 해제
async function disconnectDevice() {
    try {
        if (adb) {
            await adb.close();
            adb = null;
        }
        
        if (device) {
            device = null;
        }
        
        addLog('기기 연결이 해제되었습니다.', 'info');
        updateConnectionStatus(false);
        elements.installStatus.textContent = '대기 중';
        elements.installStatus.className = 'status-value';
        
    } catch (error) {
        addLog(`연결 해제 실패: ${error.message}`, 'error');
    }
}

// WebUSB 지원 확인
function checkWebUSBSupport() {
    if (!navigator.usb) {
        addLog('이 브라우저는 WebUSB를 지원하지 않습니다.', 'error');
        addLog('Chrome 브라우저 (버전 61 이상)를 사용해주세요.', 'warning');
        elements.connectBtn.disabled = true;
        return false;
    }
    addLog('WebUSB가 지원됩니다. 준비 완료!', 'success');
    return true;
}

// 초기화
window.addEventListener('DOMContentLoaded', () => {
    checkWebUSBSupport();
});

// 전역 함수로 노출
window.connectDevice = connectDevice;
window.installApp = installApp;
window.disconnectDevice = disconnectDevice;
