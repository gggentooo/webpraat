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
    
    // New menu
    recordMonoSound: '모노 사운드 녹음...',
    recordStereoSound: '스테레오 사운드 녹음...',
    createSoundAsPureTone: '단일 순음(Pure tone) 사운드 생성...',
    
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
    query: '조회 (Query) -',
    
    // Sound Actions
    soundToPitch: '피치 추출 (To Pitch)...',
    soundToFormantBurg: '포먼트 분석 (Burg)...',
    soundToSpectrogram: '스펙트로그램 생성...',
    soundToIntensity: '음향 강도 분석 (To Intensity)...',
    soundToTextGrid: 'TextGrid 생성...',
    
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
    paint: '스펙트로그램 그리기...',
    toSpectrumSlice: '스펙트럼 슬라이스 생성...',

    // TextGrid Actions
    exportTextGrid: 'TextGrid 내보내기...',
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
    pitchFloor: '최저 피치 한한 (Hz)',
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

    // Sound: To TextGrid Dialog
    soundToTextGridTitle: 'Sound: TextGrid 생성',
    tierNames: '모든 티어(Tier) 이름',
    pointTiers: '포인트(Point) 티어 지정',
    
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
    soundLoaded: '사운드 파일을 성공적으로 불러왔습니다.',
    pitchCalculated: '피치(Pitch) 윤곽선이 추출되었습니다.',
    formantCalculated: '포먼트(Formants)가 추출되었습니다.',
    spectrogramCalculated: '스펙트로그램이 생성되었습니다.',
    textGridCreated: 'TextGrid가 생성되었습니다.',
    textGridLoaded: 'TextGrid 파일을 성공적으로 불러왔습니다.',
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
};
