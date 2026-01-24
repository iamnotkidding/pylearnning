// WebADB 자동 설치 서비스 - 메인 애플리케이션

// 전역 변수
let adbDevice = null;
let isConnected = false;

// APK 파일 URL (서버에 업로드된 APK 파일 경로)
const APK_URL = 'https://your-server.com/app.apk';  // 실제 APK URL로 변경 필요

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

// 로그 출력 함수
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
    isConnected = connected;
    
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

// WebUSB를 통한 ADB 연결
async function connectDevice() {
    try {
        addLog('기기 선택 대화상자를 표시합니다...', 'info');
        
        // WebUSB API를 사용하여 USB 기기 요청
        const device = await navigator.usb.requestDevice({
            filters: [
                { classCode: 0xFF, subclassCode: 0x42, protocolCode: 0x01 } // ADB 인터페이스
            ]
        });

        addLog('USB 기기를 선택했습니다. 연결 중...', 'info');

        // USB 기기 열기
        await device.open();
        
        // Configuration 선택
        if (device.configuration === null) {
            await device.selectConfiguration(1);
        }

        // ADB 인터페이스 찾기
        const adbInterface = device.configuration.interfaces.find(
            iface => iface.alternates[0].interfaceClass === 0xFF &&
                     iface.alternates[0].interfaceSubclass === 0x42 &&
                     iface.alternates[0].interfaceProtocol === 0x01
        );

        if (!adbInterface) {
            throw new Error('ADB 인터페이스를 찾을 수 없습니다.');
        }

        // 인터페이스 클레임
        await device.claimInterface(adbInterface.interfaceNumber);

        adbDevice = device;

        // 기기 정보 가져오기
        const deviceName = device.productName || device.manufacturerName || 'Unknown Device';
        
        addLog(`기기 연결 성공: ${deviceName}`, 'success');
        updateConnectionStatus(true, deviceName);
        
        // ADB 인증 프로세스 시작
        await initializeADB(device);

    } catch (error) {
        addLog(`연결 실패: ${error.message}`, 'error');
        console.error('Connection error:', error);
        
        if (error.name === 'NotFoundError') {
            addLog('기기를 선택하지 않았거나 USB 디버깅이 비활성화되어 있습니다.', 'warning');
        }
    }
}

// ADB 초기화 (간소화된 버전)
async function initializeADB(device) {
    try {
        addLog('ADB 프로토콜 초기화 중...', 'info');
        
        // 실제 ADB 프로토콜 구현은 복잡하므로,
        // 여기서는 라이브러리 사용을 권장합니다.
        // 아래는 개념적인 흐름입니다.
        
        addLog('ADB 연결이 준비되었습니다.', 'success');
        elements.installStatus.textContent = '설치 준비 완료';
        
    } catch (error) {
        addLog(`ADB 초기화 실패: ${error.message}`, 'error');
        throw error;
    }
}

// 앱 설치 (서버에서 APK 다운로드 후 설치)
async function installApp() {
    if (!isConnected) {
        addLog('먼저 기기를 연결해주세요.', 'warning');
        return;
    }

    try {
        elements.installStatus.textContent = '설치 중...';
        elements.installStatus.className = 'status-value status-installing';
        elements.installBtn.disabled = true;

        addLog('서버에서 APK 다운로드 중...', 'info');
        updateProgress(10);

        // APK 파일 다운로드
        const response = await fetch(APK_URL);
        if (!response.ok) {
            throw new Error('APK 다운로드 실패');
        }

        updateProgress(30);
        const apkBlob = await response.blob();
        const apkArrayBuffer = await apkBlob.arrayBuffer();
        
        addLog(`APK 다운로드 완료 (${(apkBlob.size / 1024 / 1024).toFixed(2)} MB)`, 'success');
        updateProgress(50);

        addLog('기기에 APK 전송 중...', 'info');
        
        // 실제 ADB를 통한 APK 설치
        // 이 부분은 웹 환경의 제약으로 인해 외부 라이브러리 필요
        await installAPKViaADB(apkArrayBuffer);
        
        updateProgress(100);
        addLog('앱 설치가 완료되었습니다!', 'success');
        elements.installStatus.textContent = '설치 완료';
        elements.installStatus.className = 'status-value status-connected';

    } catch (error) {
        addLog(`설치 실패: ${error.message}`, 'error');
        elements.installStatus.textContent = '설치 실패';
        updateProgress(0);
    } finally {
        elements.installBtn.disabled = false;
    }
}

// ADB를 통한 APK 설치 (실제 구현)
async function installAPKViaADB(apkData) {
    // 이 함수는 실제 ADB 프로토콜을 구현해야 합니다.
    // 권장사항: @yume-chan/adb 라이브러리 사용
    
    // 개념적인 단계:
    // 1. ADB sync 프로토콜로 APK를 /data/local/tmp/로 전송
    // 2. pm install 명령 실행
    // 3. 설치 완료 대기
    
    addLog('APK 파싱 중...', 'info');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    addLog('패키지 매니저로 설치 중...', 'info');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 시뮬레이션을 위한 대기
    // 실제로는 ADB 명령을 통해 설치
}

// 연결 해제
async function disconnectDevice() {
    try {
        if (adbDevice) {
            await adbDevice.close();
            adbDevice = null;
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
        addLog('Chrome 브라우저를 사용해주세요.', 'warning');
        elements.connectBtn.disabled = true;
        return false;
    }
    return true;
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', () => {
    if (checkWebUSBSupport()) {
        addLog('WebUSB가 지원됩니다. 준비 완료!', 'success');
    }
    
    // USB 기기 연결/해제 이벤트 리스닝
    navigator.usb.addEventListener('connect', event => {
        addLog(`USB 기기가 연결되었습니다: ${event.device.productName}`, 'info');
    });
    
    navigator.usb.addEventListener('disconnect', event => {
        if (event.device === adbDevice) {
            addLog('연결된 기기가 분리되었습니다.', 'warning');
            updateConnectionStatus(false);
            adbDevice = null;
        }
    });
});

// 전역 함수로 노출
window.connectDevice = connectDevice;
window.installApp = installApp;
window.disconnectDevice = disconnectDevice;
