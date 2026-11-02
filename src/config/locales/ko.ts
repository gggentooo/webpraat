import type { LocaleDictionary } from './en';

/**
 * Korean localization strings for WebPraat.
 * Translates Praat phonetic concepts into standard Korean phonetic/speech science terms.
 */
export const ko: LocaleDictionary = {
  // Shell & Window Titles
  app: {
    title: 'WebPraat (웹프랏)',
    subtitle: '웹 브라우저에서 수행하는 컴퓨터 음성음운학 분석',
    objectsTitle: 'Praat 객체 (Objects)',
    pictureTitle: 'Praat 그림 (Picture)',
    infoTitle: 'Praat 정보 (Info)',
    objectsListHeader: '객체 목록:',
  },

  // Menu Bar
  menu: {
    praat: 'Praat',
    new: '새로 만들기',
    open: '열기',
    save: '저장',
    help: '도움말',
    language: '언어 (Language)',
  },

  // Menu Commands
  commands: {
    // Praat menu
    aboutPraat: 'Praat 정보...',
    aboutWebPraat: 'WebPraat 정보...',
    newPraatScript: '새 Praat 스크립트',
    openPraatScript: 'Praat 스크립트 열기...',
    clearInfo: '정보창 지우기',
    saveWorkspace: '작업 공간 저장 (OPFS)',
    clearWorkspace: '저장된 작업 공간 초기화',

    // New menu
    recordMonoSound: '모노 사운드 녹음...',
    recordStereoSound: '스테레오 사운드 녹음...',
    createSoundAsPureTone: '단일 순음(Pure tone) 사운드 생성...',
    createKlattGridFromVowel: '모음으로부터 KlattGrid 생성...',
    createSpeaker: '화자(Speaker) 모델 생성...',
    createArtword: '조음 동작(Artword) 생성...',

    // Open menu
    readFromFile: '파일에서 읽기...',
    openLongSoundFile: '긴 사운드 파일 열기...',

    // Save menu
    saveAsWavFile: 'WAV 파일로 저장...',
    saveAsTextGridFile: 'TextGrid 파일로 저장...',
    saveSelected: '선택한 객체 저장...',

    // Help menu
    praatManual: 'Praat 매뉴얼...',
    intro: '소개 (Intro)',
  },

  // Fixed Bottom Buttons on Objects Window
  fixedButtons: {
    rename: '이름 변경...',
    copy: '복사...',
    inspect: '검사 (Inspect)',
    info: '정보 (Info)',
    remove: '제거 (Remove)',
  },

  // Dynamic Actions
  actions: {
    viewAndEdit: '보기 및 편집 (View & Edit)',
    play: '재생',
    stop: '정지',
    draw: '그리기...',
    speckle: '산점도 그리기 (Speckle)...',
    query: '조회 (Query) -',
    synthesise: '합성 (Synthesise) -',
    analysePeriodicity: '주기성 분석 -',
    analyseSpectrum: '스펙트럼 분석 -',

    // Sound Actions
    soundToPitch: '피치 추출 (To Pitch)...',
    soundToFormantBurg: '포먼트 분석 (Burg)...',
    soundToSpectrogram: '스펙트로그램 생성...',
    soundToIntensity: '음향 강도 분석 (To Intensity)...',
    soundToTextGrid: 'TextGrid 생성...',
    soundToPowerCepstrogram: '파워 켑스트로그램 분석 (PowerCepstrogram)...',
    soundToLpcBurg: '선형예측부호화 분석 (LPC burg)...',
    soundToMfcc: '멜 주파수 켑스트럼 분석 (MFCC)...',
    soundToKlattGrid: 'KlattGrid 변환 (단순)...',

    // Sound Queries
    getNumChannels: '채널 수 확인',
    getNumSamples: '샘플 수 확인',
    getSampleRate: '샘플링 주파수 확인',
    getSamplePeriod: '샘플링 주기 확인',
    getDuration: '총 길이 확인',
    getMean: '평균값 가져오기...',
    getRms: '제곱평균제곱근(RMS) 가져오기...',
    getValueAtTime: '특정 시점 값 가져오기...',

    // Pitch Actions
    pitchGetMean: '평균 피치(F0) 가져오기...',
    pitchGetValueAtTime: '특정 시점 피치 가져오기...',
    countVoicedFrames: '유성음 프레임 수 세기',
    toSoundPulses: '사운드로 변환 (펄스)',
    toSoundHum: '사운드로 변환 (허밍)',
    toSoundSine: '사운드로 변환 (사인파)...',

    // Formant Actions
    downToTable: '테이블로 변환...',
    track: '포먼트 트랙 추적...',

    // Spectrogram Actions
    paint: '스펙트로그램 칠하기 (Paint)...',
    toSpectrumSlice: '스펙트럼 슬라이스 생성...',

    // TextGrid Actions
    exportTextGrid: 'TextGrid 내보내기...',

    // Advanced DSP Object Actions (Phase 7)
    getCpps: '평활 켑스트럼 피크 두드러짐 조회 (Get CPPS)...',
    toCpp: 'CPP 윤곽선 추출 (To CPP)...',
    toFormant: '포먼트로 변환 (To Formant)',
    toSound: '사운드 합성 (To Sound)',
    artwordSpeakerToSound: '조음 사운드 합성 (To Sound)...',
  },

  // Dialogs & Forms
  dialogs: {
    ok: '확인 (OK)',
    cancel: '취소',
    apply: '적용',
    standards: '기본값 (Standards)',
    close: '닫기',

    // Rename Dialog
    renameTitle: '객체 이름 변경',
    newName: '새 이름',

    // Copy Dialog
    copyTitle: '객체 복사',
    nameOfNewObject: '새 객체의 이름',

    // Pure Tone Dialog
    pureToneTitle: '단일 순음 사운드 생성',
    name: '이름',
    toneFrequency: '주파수 (Hz)',
    toneDuration: '길이 (초)',
    toneSampleRate: '샘플링 주파수 (Hz)',
    toneAmplitude: '진폭 (0-1)',

    // Sound: To Pitch Dialog
    soundToPitchTitle: 'Sound: 피치(F0) 추출',
    timeStep: '시간 간격 (초)',
    timeStepAuto: '0.0 (= 자동)',
    pitchFloor: '최저 피치 하한 (Hz)',
    pitchCeiling: '최고 피치 상한 (Hz)',

    // Sound: To Formant Dialog
    soundToFormantTitle: 'Sound: 포먼트 분석 (Burg 방식)',
    maxNumFormants: '최대 포먼트 개수',
    formantCeiling: '포먼트 상한 (Hz)',
    windowLength: '윈도우 길이 (초)',
    preEmphasisFrom: '프리엠퍼시스 시작 주파수 (Hz)',

    // Sound: To Spectrogram Dialog
    soundToSpectrogramTitle: 'Sound: 스펙트로그램 생성',
    maxFrequency: '최대 주파수 (Hz)',
    frequencyStep: '주파수 간격 (Hz)',
    windowShape: '윈도우 모양 (Window shape)',

    // Sound: To Intensity Dialog
    soundToIntensityTitle: 'Sound: 음향 강도(Intensity) 분석',
    subtractMean: '평균 직류 성분 차감 (Subtract mean)',

    // Sound: To TextGrid Dialog
    soundToTextGridTitle: 'Sound: TextGrid 생성',
    tierNames: '모든 티어(Tier) 이름',
    pointTiers: '포인트(Point) 티어 지정',

    // Cepstral / CPP Dialogs
    soundToPowerCepstrogramTitle: 'Sound: 파워 켑스트로그램 분석',
    powerCepstrogramGetCppsTitle: 'PowerCepstrogram: CPPS 조회',
    subtractTrendBeforeSmoothing: '평활화 전 추세선 차감',
    timeAveragingWindow: '시간 평균 윈도우 (초)',
    quefrencyAveragingWindow: '켑프런시(Quefrency) 평균 윈도우 (초)',
    powerCepstrogramToCppTitle: 'PowerCepstrogram: CPP 윤곽선 추출',
    cppGetMeanTitle: 'CPP: 평균값 조회',

    // LPC & MFCC Dialogs
    soundToLpcBurgTitle: 'Sound: 선형예측부호화 분석 (LPC burg)',
    predictionOrder: '예측 차수 (Prediction order)',
    soundToMfccTitle: 'Sound: MFCC 추출',
    numCoefficients: '켑스트럼 계수 개수',
    f1Mel: '첫 번째 필터 위치 (mel)',
    dfMel: '필터 간격 (mel)',
    fmaxMel: '최대 주파수 (mel)',

    // KlattGrid Dialogs
    createKlattGridFromVowelTitle: '모음으로부터 KlattGrid 생성',
    f0Start: '시작 기본주파수 F0 (Hz)',
    f1Hz: '제1포먼트 F1 주파수 (Hz)',
    b1Hz: '제1포먼트 B1 대역폭 (Hz)',
    f2Hz: '제2포먼트 F2 주파수 (Hz)',
    b2Hz: '제2포먼트 B2 대역폭 (Hz)',
    f3Hz: '제3포먼트 F3 주파수 (Hz)',
    b3Hz: '제3포먼트 B3 대역폭 (Hz)',
    f4Hz: '제4포먼트 F4 주파수 (Hz)',
    soundToKlattGridTitle: 'Sound: KlattGrid 변환 (단순)',

    // Articulatory Synthesis Dialogs
    createSpeakerTitle: '화자(Speaker) 생성',
    kindOfSpeaker: '화자 유형',
    speakerFemale: '여성 (Female)',
    speakerMale: '남성 (Male)',
    speakerChild: '아동 (Child)',
    numVocalCordMasses: '성문 질량(Tube) 개수',
    createArtwordTitle: '조음 동작(Artword) 생성',
    totalTime: '전체 시간 (초)',
    defaultVoicedGesture: '기본 유성 음절 조음 타깃 초기화',
    artwordSpeakerToSoundTitle: 'Artword & Speaker: 조음 음성 합성',
    oversamplingFactor: '오버샘플링 배수',

    // Draw Dialog
    drawObjectTitle: 'Praat 그림창(Picture)에 그리기',
    minValue: '최솟값 (0 = 자동)',
    maxValue: '최댓값 (0 = 자동)',
    dynamicRangeDb: '동적 범위 (dB)',
    garnish: '축 및 눈금 장식 표시 (Garnish)',

    // Range queries
    soundGetMeanTitle: 'Sound: 평균값 조회',
    pitchGetMeanTitle: 'Pitch: 평균 피치 조회',
    pitchGetValueAtTimeTitle: 'Pitch: 특정 시점 피치 조회',
    fromTime: '시작 시간 (초)',
    toTime: '종료 시간 (초)',
    toTimeAll: '(= 전체)',
    time: '시간 (초)',
    channel: '채널 (0 = 전체)',
  },

  // SoundRecorder (Phase 7)
  recorder: {
    monoTitle: '사운드 녹음기 (모노)',
    stereoTitle: '사운드 녹음기 (스테레오)',
    channels: '채널 구성',
    mono: '모노 (Mono)',
    stereo: '스테레오 (Stereo)',
    inputSource: '입력 장치',
    defaultMicrophone: '기본 마이크',
    sampleRate: '샘플링 주파수',
    meter: '입력 레벨 미터',
    clipping: '클리핑(CLIP)',
    record: '녹음 (Record)',
    stop: '정지 (Stop)',
    play: '재생 (Play)',
    duration: '녹음 길이',
    name: '객체 이름',
    saveToList: '목록에 저장',
    saveToListAndClose: '목록에 저장 후 닫기',
    readyToRecord: '[녹음] 버튼을 누르면 AudioWorklet으로 마이크 입력을 캡처합니다.',
    recordingInProgress: '마이크로부터 실시간 녹음 중...',
    noRecordingYet: '아직 녹음된 오디오가 없습니다.',
    permissionDenied: '마이크 접근 권한이 거부되었거나 사용할 수 있는 입력 장치가 없습니다.',
  },

  // Picture Window (Phase 7)
  picture: {
    outerViewport: '외부 뷰포트 (인치)',
    colour: '색상',
    lineWidth: '선 두께',
    lineType: '선 스타일',
    solid: '실선 (Solid)',
    dotted: '점선 (Dotted)',
    dashed: '파선 (Dashed)',
    dashDotted: '일점쇄선 (Dash-dotted)',
    fontSize: '글꼴 크기',
    garnish: '축 장식 (Garnish)',
    drawInnerBox: '내부 테두리 그리기',
    textTop: '상단 제목 추가...',
    enterTitlePrompt: '뷰포트 상단에 표시할 텍스트:',
    undo: '실행 취소',
    redo: '다시 실행',
    eraseAll: '모두 지우기 (Erase all)',
    exportPng: 'PNG 파일로 저장...',
    exportSvg: 'SVG 벡터 파일로 저장...',
    emptyHint: '12" × 12" 용지 위에서 마우스를 드래그해 외부 뷰포트를 선택한 후 객체의 [그리기...] 버튼을 누르세요.',
    commandsCount: '개 요소',
    closeTab: '그림창 닫기',
  },

  // Info Window
  info: {
    clear: '지우기',
    copy: '복사',
    copied: '복사됨!',
    empty: '(아직 출력된 정보가 없습니다. 객체를 선택한 뒤 상단 조회(Query) 또는 하단 정보(Info)를 누르세요.)',
  },

  // Units & Formats
  units: {
    seconds: '초 (seconds)',
    hz: 'Hz',
    db: 'dB',
    samples: '샘플 (samples)',
    channels: '채널 (channels)',
    channelMono: '채널 (모노)',
    channelStereo: '채널 (스테레오)',
    pascal: 'Pascal',
  },

  // Status & Messages
  status: {
    ready: '준비 완료',
    loading: '처리 중...',
    soundCreated: '사운드가 생성되었습니다.',
    soundRecorded: '녹음된 사운드가 객체 목록에 저장되었습니다.',
    soundLoaded: '사운드 파일을 성공적으로 불러왔습니다.',
    pitchCalculated: '피치(Pitch) 윤곽선이 추출되었습니다.',
    formantCalculated: '포먼트(Formants)가 추출되었습니다.',
    spectrogramCalculated: '스펙트로그램이 생성되었습니다.',
    intensityCalculated: '음향 강도(Intensity) 윤곽선이 추출되었습니다.',
    cepstrogramCalculated: '파워 켑스트로그램(PowerCepstrogram)이 계산되었습니다.',
    cppCalculated: 'CPP 윤곽선이 추출되었습니다.',
    lpcCalculated: '선형예측부호화(LPC burg) 분석이 완료되었습니다.',
    mfccCalculated: 'MFCC 계수가 추출되었습니다.',
    klattGridCreated: 'KlattGrid 객체가 생성되었습니다.',
    speakerCreated: '화자(Speaker) 모델이 생성되었습니다.',
    artwordCreated: '조음 동작(Artword) 객체가 생성되었습니다.',
    articulatorySoundSynthesized: '조음 음성 합성 사운드가 생성되었습니다.',
    textGridCreated: 'TextGrid가 생성되었습니다.',
    textGridLoaded: 'TextGrid 파일을 성공적으로 불러왔습니다.',
    drawnToPicture: 'Praat 그림창(Picture)에 요소를 그렸습니다.',
    pictureExported: 'Praat 그림 파일이 내보내졌습니다.',
    workspaceSaved: '작업 공간이 OPFS에 저장되었습니다.',
    workspaceRestored: 'OPFS에서 이전 작업 공간을 복원했습니다.',
    workspaceCleared: '저장된 OPFS 작업 공간을 초기화했습니다.',
    objectRemoved: '객체가 제거되었습니다.',
    noSelection: '선택된 객체가 없습니다.',
    dragDropPrompt: '오디오 파일을 여기에 끌어다 놓거나 [열기] -> [파일에서 읽기...] 메뉴를 사용하세요.',
  },

  // Editor Views
  editor: {
    soundEditorTitle: '사운드 에디터',
    textGridEditorTitle: 'TextGrid 에디터',
    placeholderNotice: '파형 및 스펙트로그램 뷰는 4단계에서 구현됩니다.',
    closeEditor: '에디터 닫기',
    showSpectrogram: '스펙트로그램 표시',
    showPitch: '피치(F0) 표시',
    showFormants: '포먼트 표시',
    showIntensity: '음향 강도 표시',
    greyscale: '흑백',
    colour: '컬러',
    zoomAll: '전체 (all)',
    zoomIn: '확대 (in)',
    zoomOut: '축소 (out)',
    zoomSel: '선택 (sel)',
    zoomBak: '이전 (bak)',
    undo: '실행 취소 (undo)',
    redo: '다시 실행 (redo)',
    visible: '화면 범위',
    selection: '선택 범위',
    total: '전체 길이',
    frequencyHz: '주파수 (Hz)',
    pitchHz: '피치 (Hz)',
    intensityDb: '음향 강도 (dB)',
    timeSeconds: '시간 (초)',
    channel1: '채널 1',
    channel2: '채널 2',
    pitchRange: '75 - 500 Hz',
    intensityRange: '50 - 100 dB',
    playSelection: '선택영역 재생',
    playWindow: '화면영역 재생',
  },

  // Script Console
  script: {
    title: 'Praat 스크립트',
    run: '실행 (Run)',
    running: '실행 중...',
    clear: '지우기',
    clearInfo: '정보창 지우기',
    samples: '샘플 스크립트...',
    sampleArithmetic: '반복문 및 수학 계산',
    sampleProcedures: '프로시저 및 문자열 처리',
    sampleVariables: '변수 일괄 연산',
    samplePicture: 'Praat 그림창(Picture) 벡터 드로잉',
    openScript: '열기...',
    saveScript: '저장...',
    shortcutHint: 'Ctrl+Enter로 실행',
    scriptCompleted: '스크립트가 성공적으로 실행되었습니다',
    scriptError: '스크립트 실행 중 오류가 발생했습니다',
    closeTab: '스크립트 창 닫기',
  },
};
