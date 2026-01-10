import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Command {
    name: string;
    command: string;
}

interface Column {
    title: string;
    commands: Command[];
}

interface WindowConfig {
    width: number;
    height: number;
}

interface Config {
    window?: WindowConfig;
    columns: Column[];
}

interface RunningProcess {
    process: ChildProcess;
    deviceIds: string[];
}

interface DeviceInfo {
    id: string;
    fullLine: string;
}

class ADBManager {
    private devices: DeviceInfo[] = [];
    private runningProcesses: Map<string, RunningProcess> = new Map();
    private config: Config | null = null;
    private sequentialMode: boolean = true;
    private timeValue: number = 5;
    private pairCount: number = 2;
    private useCustomAdbPath: boolean = false;
    private adbPath: string = process.cwd();

    constructor() {
        this.loadConfig();
    }

    /**
     * ADB 경로를 설정합니다
     */
    setAdbPath(customPath: string | null): void {
        if (customPath) {
            this.useCustomAdbPath = true;
            this.adbPath = customPath;
        } else {
            this.useCustomAdbPath = false;
            this.adbPath = process.cwd();
        }
    }

    /**
     * ADB 명령어에 경로를 적용합니다
     */
    private getAdbCommand(baseCommand: string): string {
        const workDir = this.useCustomAdbPath ? this.adbPath : process.cwd();
        
        // Windows
        if (process.platform === 'win32') {
            return `cd /d "${workDir}" && ${baseCommand}`;
        }
        // Linux/Mac
        else {
            return `cd "${workDir}" && ${baseCommand}`;
        }
    }

    /**
     * JSON 설정 파일을 로드합니다
     */
    private loadConfig(): void {
        const configFile = 'adb_commands.json';

        if (!fs.existsSync(configFile)) {
            const defaultConfig: Config = {
                window: {
                    width: 1200,
                    height: 700
                },
                columns: [
                    {
                        title: '기본 명령',
                        commands: [
                            {
                                name: '화면 캡처',
                                command: 'adb -s ADBID shell screencap -p /sdcard/screen.png'
                            },
                            {
                                name: '앱 목록 보기',
                                command: 'adb -s ADBID shell pm list packages'
                            }
                        ]
                    },
                    {
                        title: '그룹 명령',
                        commands: [
                            {
                                name: '그룹 장치 정보',
                                command: 'echo Devices: ADBIDS'
                            }
                        ]
                    }
                ]
            };

            fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 4));
            console.log(`기본 설정 파일 생성: ${configFile}`);
        }

        const configData = fs.readFileSync(configFile, 'utf-8');
        this.config = JSON.parse(configData);
        
        // 윈도우 크기 정보 출력 (GUI 앱에서 사용)
        if (this.config?.window) {
            console.log(`윈도우 크기 설정: ${this.config.window.width}x${this.config.window.height}`);
        }
        
        console.log(`설정 로드 완료: ${this.config?.columns.length}개 열`);
    }

    /**
     * ADB 장치 목록을 가져옵니다
     */
    async refreshDevices(): Promise<DeviceInfo[]> {
        try {
            const { stdout } = await execAsync('adb devices -l');
            const lines = stdout.trim().split('\n').slice(1); // 첫 줄 제외

            this.devices = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('*')) {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length >= 2) {
                        this.devices.push({
                            id: parts[0],
                            fullLine: trimmed
                        });
                    }
                }
            }

            console.log(`장치 ${this.devices.length}개 발견`);
            return this.devices;
        } catch (error) {
            console.error('장치 목록 로드 실패:', error);
            return [];
        }
    }

    /**
     * 장치 ID를 추출합니다
     */
    private extractDeviceId(deviceString: string): string {
        return deviceString.split(/\s+/)[0];
    }

    /**
     * 특정 장치의 실행 중인 명령을 취소합니다
     */
    private cancelDeviceCommand(deviceId: string): void {
        const processInfo = this.runningProcesses.get(deviceId);
        if (processInfo) {
            try {
                processInfo.process.kill('SIGTERM');
                setTimeout(() => {
                    if (processInfo.process.killed === false) {
                        processInfo.process.kill('SIGKILL');
                    }
                }, 2000);
                console.log(`\x1b[31m[${deviceId}] 이전 명령 취소됨\x1b[0m`);
            } catch (error) {
                console.error(`[${deviceId}] 프로세스 종료 실패:`, error);
            }
            this.runningProcesses.delete(deviceId);
        }
    }

    /**
     * 명령어를 실행합니다
     */
    async executeCommand(
        commandTemplate: string,
        selectedDevice: string | 'all'
    ): Promise<void> {
        // ADBIDS 검증
        if (commandTemplate.includes('ADBIDS')) {
            if (selectedDevice !== 'all') {
                throw new Error('ADBIDS 변수는 all devices 선택 시에만 사용 가능합니다.');
            }
        }

        // 실행할 장치 목록 결정
        let devicesToRun: string[];
        if (selectedDevice === 'all') {
            devicesToRun = this.devices.map(d => d.id);
        } else {
            devicesToRun = [selectedDevice];
        }

        // 이전 명령 취소
        for (const deviceId of devicesToRun) {
            this.cancelDeviceCommand(deviceId);
        }

        // ADBIDS 명령 처리
        if (commandTemplate.includes('ADBIDS')) {
            await this.executeAdbidsCommand(commandTemplate);
        } else {
            await this.executeRegularCommand(commandTemplate, selectedDevice);
        }
    }

    /**
     * ADBIDS 명령을 실행합니다
     */
    private async executeAdbidsCommand(commandTemplate: string): Promise<void> {
        const deviceIds = this.devices.map(d => d.id);
        const groups: string[][] = [];

        // 그룹 생성
        for (let i = 0; i < deviceIds.length; i += this.pairCount) {
            groups.push(deviceIds.slice(i, i + this.pairCount));
        }

        console.log(
            this.sequentialMode
                ? '\n=== 순차 실행 모드 (ADBIDS) ==='
                : '\n=== 동시 실행 모드 (ADBIDS) ==='
        );

        if (this.sequentialMode) {
            // 순차 실행
            for (const group of groups) {
                await this.executeGroupCommand(commandTemplate, group);
            }
        } else {
            // 동시 실행
            const promises = groups.map(group =>
                this.executeGroupCommand(commandTemplate, group)
            );
            await Promise.all(promises);
            console.log('\n=== 모든 그룹 실행 완료 ===');
        }
    }

    /**
     * 그룹 명령을 실행합니다
     */
    private async executeGroupCommand(
        commandTemplate: string,
        deviceIds: string[]
    ): Promise<void> {
        const adbidsValue = deviceIds.join(',');
        let cmd = commandTemplate
            .replace(/ADBIDS/g, adbidsValue)
            .replace(/TIME/g, this.timeValue.toString());

        // ADB 경로 적용
        cmd = this.getAdbCommand(cmd);

        console.log(`\n[그룹: ${deviceIds.join(',')}] 실행: ${cmd}`);

        return new Promise((resolve, reject) => {
            const process = exec(cmd, { encoding: 'utf-8', timeout: 30000 });

            // 프로세스 등록
            const processInfo: RunningProcess = { process, deviceIds };
            for (const deviceId of deviceIds) {
                this.runningProcesses.set(deviceId, processInfo);
            }

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                stdout += data;
            });

            process.stderr?.on('data', (data) => {
                stderr += data;
            });

            process.on('close', (code) => {
                // 프로세스 정리
                for (const deviceId of deviceIds) {
                    this.runningProcesses.delete(deviceId);
                }

                if (stdout) {
                    console.log(`[그룹: ${deviceIds.join(',')}] 출력:\n${stdout}`);
                }
                if (stderr) {
                    console.log(`[그룹: ${deviceIds.join(',')}] 에러:\n${stderr}`);
                }

                resolve();
            });

            process.on('error', (error) => {
                console.error(`[그룹: ${deviceIds.join(',')}] 실행 실패:`, error);
                for (const deviceId of deviceIds) {
                    this.runningProcesses.delete(deviceId);
                }
                reject(error);
            });
        });
    }

    /**
     * 일반 명령을 실행합니다 (ADBID, ADBNUM 사용)
     */
    private async executeRegularCommand(
        commandTemplate: string,
        selectedDevice: string | 'all'
    ): Promise<void> {
        const commands: Array<{ deviceId: string; cmd: string }> = [];

        if (selectedDevice === 'all') {
            // 모든 장치에 대해 실행
            for (let idx = 0; idx < this.devices.length; idx++) {
                const deviceId = this.devices[idx].id;
                const deviceNum = (idx + 1).toString();
                let cmd = commandTemplate
                    .replace(/ADBID/g, deviceId)
                    .replace(/ADBNUM/g, deviceNum)
                    .replace(/TIME/g, this.timeValue.toString());
                
                // ADB 경로 적용
                cmd = this.getAdbCommand(cmd);
                
                commands.push({ deviceId, cmd });
            }
        } else {
            // 선택된 장치만
            const idx = this.devices.findIndex(d => d.id === selectedDevice);
            const deviceNum = (idx + 1).toString();
            let cmd = commandTemplate
                .replace(/ADBID/g, selectedDevice)
                .replace(/ADBNUM/g, deviceNum)
                .replace(/TIME/g, this.timeValue.toString());
            
            // ADB 경로 적용
            cmd = this.getAdbCommand(cmd);
            
            commands.push({ deviceId: selectedDevice, cmd });
        }

        console.log(
            this.sequentialMode
                ? '\n=== 순차 실행 모드 ==='
                : '\n=== 동시 실행 모드 ==='
        );

        if (this.sequentialMode) {
            // 순차 실행
            for (const { deviceId, cmd } of commands) {
                await this.executeDeviceCommand(deviceId, cmd);
            }
        } else {
            // 동시 실행
            const promises = commands.map(({ deviceId, cmd }) =>
                this.executeDeviceCommand(deviceId, cmd)
            );
            await Promise.all(promises);
            console.log('\n=== 모든 장치 실행 완료 ===');
        }
    }

    /**
     * 개별 장치 명령을 실행합니다
     */
    private async executeDeviceCommand(
        deviceId: string,
        cmd: string
    ): Promise<void> {
        console.log(`\n[${deviceId}] 실행: ${cmd}`);

        return new Promise((resolve, reject) => {
            const process = exec(cmd, { encoding: 'utf-8', timeout: 30000 });

            // 프로세스 등록
            this.runningProcesses.set(deviceId, {
                process,
                deviceIds: [deviceId]
            });

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                stdout += data;
            });

            process.stderr?.on('data', (data) => {
                stderr += data;
            });

            process.on('close', (code) => {
                this.runningProcesses.delete(deviceId);

                if (stdout) {
                    console.log(`[${deviceId}] 출력:\n${stdout}`);
                }
                if (stderr) {
                    console.log(`[${deviceId}] 에러:\n${stderr}`);
                }

                resolve();
            });

            process.on('error', (error) => {
                console.error(`[${deviceId}] 실행 실패:`, error);
                this.runningProcesses.delete(deviceId);
                reject(error);
            });
        });
    }

    /**
     * 설정을 업데이트합니다
     */
    setSequentialMode(sequential: boolean): void {
        this.sequentialMode = sequential;
    }

    setTimeValue(time: number): void {
        this.timeValue = Math.floor(time); // int로 변환
    }

    setPairCount(count: number): void {
        if (count < 1) {
            throw new Error('짝지을 보드 대수는 1 이상이어야 합니다.');
        }
        this.pairCount = count;
    }

    /**
     * 설정 정보를 가져옵니다
     */
    getConfig(): Config | null {
        return this.config;
    }

    getDevices(): DeviceInfo[] {
        return this.devices;
    }
}

// 사용 예시
async function main() {
    const manager = new ADBManager();

    // ADB 경로 설정 (선택사항)
    // manager.setAdbPath('C:\\platform-tools'); // 사용자 지정 경로
    // manager.setAdbPath(null); // 현재 경로 사용

    // 설정
    manager.setSequentialMode(true);
    manager.setTimeValue(5);
    manager.setPairCount(2);

    // 장치 목록 가져오기
    await manager.refreshDevices();
    const devices = manager.getDevices();
    console.log('연결된 장치:', devices);

    // 명령 실행 예시
    try {
        // 단일 장치 명령
        if (devices.length > 0) {
            await manager.executeCommand(
                'adb -s ADBID shell getprop ro.product.model',
                devices[0].id
            );
        }

        // All devices 명령
        await manager.executeCommand(
            'adb -s ADBID shell dumpsys battery',
            'all'
        );

        // ADBIDS 그룹 명령
        await manager.executeCommand(
            'echo Processing: ADBIDS',
            'all'
        );
    } catch (error) {
        console.error('명령 실행 오류:', error);
    }
}

// 모듈로 내보내기
export { ADBManager, Command, Column, WindowConfig, Config, DeviceInfo };

// 직접 실행 시
if (require.main === module) {
    main().catch(console.error);
}
