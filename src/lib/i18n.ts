// i18n dictionary for the MUSE GESTURES site.
// Two languages: English (default) and Russian.
// All user-facing strings live here — components reference them via the
// `useTranslation()` hook from the Zustand store's `language` field.

export type Language = 'en' | 'ru';

export interface Translation {
  // Navbar
  navGestures: string;
  navLaunch: string;
  navLangEn: string;
  navLangRu: string;

  // Hero (section 01)
  heroLabel: string;
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroBody: string;
  heroCta: string;
  scroll: string;

  // Tech (section 02)
  techLabel: string;
  techTitleLine1: string;
  techTitleLine2: string;
  techTitleLine3: string;
  techBody1: string;
  techBody2: string;
  techTrackingLabel: string;
  techTrackingTitle: string;
  techTrackingDesc: string;
  techEngineLabel: string;
  techEngineTitle: string;
  techEngineDesc: string;
  techSynthLabel: string;
  techSynthTitle: string;
  techSynthDesc: string;

  // Gestures (section 03)
  gesturesLabel: string;
  gesturesTitleLine1: string;
  gesturesTitleLine2: string;
  gesturesBody1: string;
  gesturesBody2: string;
  gesturesCaption: string;
  openPdf: string;

  // Final CTA (section 04)
  finalLabel: string;
  finalTitle: string;
  finalBody: string;
  finalCta: string;

  // Footer
  footerTagline1: string;
  footerTagline2: string;

  // Play view — top bar
  back: string;
  startAudio: string;
  starting: string;
  audioLive: string;

  // Play view — sidebar
  settings: string;
  mirrorCamera: string;
  swapHands: string;
  gestures: string;
  lOpenness: string;
  lRoll: string;
  lScale: string;
  rIndex: string;
  rOpenness: string;
  rPinch: string;
  activeSample: string;
  nameLabel: string;
  baseNoteLabel: string;
  fileLabel: string;
  noSampleLoaded: string;
  onPageLoad: string;
  status: string;
  trackingReady: string;
  audioStartedLabel: string;
  handsVisible: string;
  harpGate: string;
  yes: string;
  no: string;
  open: string;
  closed: string;

  // Play view — overlay
  clickToBegin: string;
  browserGesture: string;
}

export const translations: Record<Language, Translation> = {
  en: {
    navGestures: 'MUSE',
    navLaunch: 'Launch',
    navLangEn: 'ENG',
    navLangRu: 'RU',

    heroLabel: 'The Installation',
    heroTitleLine1: 'Conduct sound',
    heroTitleLine2: 'with your hands.',
    heroBody:
      'A real-time sound installation where movement becomes music. A webcam tracks your hands, a custom engine translates gestures into a living pad, a pentatonic laser harp, and a vocal ostinato — all in the browser.',
    heroCta: 'Launch camera',
    scroll: 'DIVE IN',

    techLabel: 'How it works',
    techTitleLine1: 'Three layers,',
    techTitleLine2: 'two hands,',
    techTitleLine3: 'one instrument.',
    techBody1:
      'Every gesture maps to a specific sound parameter. The left hand sculpts the atmosphere — a drone pad, a vocal ostinato, the reverb amount. The right hand plays the melody.',
    techBody2:
      'The audio engine is fully synthesized in the browser through the Web Audio API. No backend roundtrip, no latency beyond the camera frame.',
    techTrackingLabel: 'Tracking',
    techTrackingTitle: 'MediaPipe Hands',
    techTrackingDesc:
      'Google on-device hand landmarker. 21 keypoints per hand, stable inference, GPU-accelerated. Confidence thresholds and a temporal consistency filter reject false positives.',
    techEngineLabel: 'Engine',
    techEngineTitle: 'Web Audio API',
    techEngineDesc:
      'A custom graph of oscillators, filters, convolution reverb, and feedback delay — all running natively in the browser, sample-accurate and zero-latency.',
    techSynthLabel: 'Synthesis',
    techSynthTitle: 'Three voices',
    techSynthDesc:
      'An evolving pad inspired by the "Forsitan Modulare" - Draen module, a monophonic sample-based laser harp, and a looped vocal ostinato.',

    gesturesLabel: 'The gestures',
    gesturesTitleLine1: 'Six gestures.',
    gesturesTitleLine2: 'Two roles.',
    gesturesBody1:
      'The left hand controls the atmosphere. The right hand plays the melody. Each gesture below is wired to a specific parameter of the audio engine — move your hand, hear the change instantly.',
    gesturesBody2:
      'Hold your hands in the frame, in front of the camera. Smooth movements produce smooth sound.',
    gesturesCaption:
      'Fig. 1 — Six gestures, two hands. The left hand sculpts the drone; the right hand plays the melody.',
    openPdf: 'Open PDF',

    finalLabel: 'Begin',
    finalTitle: 'Ready to play?',
    finalBody:
      'You will be asked for camera access. The audio engine starts on your input only — we require a user gesture before any sound can play.',
    finalCta: 'Launch camera',

    footerTagline1: 'Real-time hand-controlled sound',
    footerTagline2: 'Browser-native, no install',

    back: 'Back',
    startAudio: 'Start audio',
    starting: 'Starting…',
    audioLive: 'Audio live',

    settings: 'Settings',
    mirrorCamera: 'Mirror camera',
    swapHands: 'Swap Left/Right hands',
    gestures: 'Gestures',
    lOpenness: 'L · openness — pad filter (fist = silent, open = bright)',
    lRoll: 'L · roll — vox volume (vertical = silent, 90° right = full)',
    lScale: 'L · scale — reverb amount (closer = more reverb)',
    rIndex: 'R · index fingertip — play pentatonic grid 5×5',
    rOpenness: 'R · openness — delay/echo amount',
    rPinch: 'R · pinch — tanpura strum (coming soon)',
    activeSample: 'Active sample',
    nameLabel: 'Name:',
    baseNoteLabel: 'Base note:',
    fileLabel: 'File:',
    noSampleLoaded: 'No sample loaded. Samples are loaded automatically from',
    onPageLoad: 'on page load.',
    status: 'Status',
    trackingReady: 'Tracking ready:',
    audioStartedLabel: 'Audio started:',
    handsVisible: 'Hands visible:',
    harpGate: 'Harp gate:',
    yes: 'yes',
    no: 'no',
    open: 'open',
    closed: 'closed',

    clickToBegin: 'Click "Start audio" to begin',
    browserGesture:
      'We require a user gesture before any sound can play. After you click, the pad engine starts in the background and the harp becomes playable once a sample is loaded.',
  },

  ru: {
    navGestures: 'MUSE',
    navLaunch: 'Запустить',
    navLangEn: 'ENG',
    navLangRu: 'RU',

    heroLabel: 'Инсталляция',
    // NBSP removed — wrapping is controlled by CSS (whitespace-normal
    // sm:whitespace-nowrap) in LandingPage.tsx, so "звуком" wraps on
    // mobile but stays on one line on desktop.
    heroTitleLine1: 'Управляй звуком',
    heroTitleLine2: 'своими руками.',
    heroBody:
      'Звуковая инсталляция в реальном времени, где движение становится музыкой. Веб-камера отслеживает ваши руки, собственный движок переводит жесты в живой пэд, пентатоническую лазерную арфу и вокальное остинато — всё в браузере.',
    heroCta: 'Запустить камеру',
    scroll: 'Погрузиться',

    techLabel: 'Как это работает',
    techTitleLine1: 'Три слоя,',
    techTitleLine2: 'две руки,',
    techTitleLine3: 'один инструмент.',
    techBody1:
      'Каждый жест привязан к конкретному параметру звука. Левая рука формирует атмосферу — пэд, вокальное остинато, реверберацию. Правая рука отвечает за мелодию.',
    techBody2:
      'Звуковой движок полностью синтезируется в браузере через Web Audio API. Без обращений к серверу, без задержек сверх кадра камеры.',
    techTrackingLabel: 'Трекинг',
    techTrackingTitle: 'MediaPipe Hands',
    techTrackingDesc:
      'Локальная модель от Google. 21 ключевая точка на руку, стабильный инференс, GPU-ускорение. Пороги уверенности и временной фильтр отсекают ложные срабатывания.',
    techEngineLabel: 'Движок',
    techEngineTitle: 'Web Audio API',
    techEngineDesc:
      'Собственный граф осцилляторов, фильтров, свёрточного ревербератора и фидбэк-задержки — всё работает нативно в браузере, с точностью до сэмпла и нулевой задержкой.',
    techSynthLabel: 'Синтез',
    techSynthTitle: 'Три голоса',
    techSynthDesc:
      'Эволюционирующий пэд по образу модуля "Forsitan Modulare" - Draen, полифоническая лазерная арфа на семплах и зацикленное вокальное остинато.',

    gesturesLabel: 'Жесты',
    gesturesTitleLine1: 'Шесть жестов.',
    gesturesTitleLine2: 'Две роли.',
    gesturesBody1:
      'Левая рука управляет атмосферой. Правая рука играет мелодию. Каждый жест ниже привязан к конкретному параметру звукового движка — двигайте рукой и слышите изменение мгновенно.',
    gesturesBody2:
      'Держите руки в кадре, перед камерой. Плавные движения создают плавный звук.',
    gesturesCaption:
      'Рис. 1 — Шесть жестов, две руки. Левая рука формирует дрон; правая играет мелодию.',
    openPdf: 'Открыть PDF',

    finalLabel: 'Начать',
    finalTitle: 'Готовы играть?',
    finalBody:
      'Потребуется доступ к камере. Звуковой движок запускается по вашему клику — мы требуем жеста пользователя перед воспроизведением звука.',
    finalCta: 'Запустить камеру',

    footerTagline1: 'Звук в реальном времени под управлением жестов',
    footerTagline2: 'В браузере, без установки',

    back: 'Назад',
    startAudio: 'Запустить звук',
    starting: 'Запуск…',
    audioLive: 'Звук активен',

    settings: 'Настройки',
    mirrorCamera: 'Зеркалить камеру',
    swapHands: 'Поменять руки местами',
    gestures: 'Жесты',
    lOpenness: 'Л · раскрытие — фильтр пэда (кулак = тишина, открыта = ярко)',
    lRoll: 'Л · поворот — громкость вокала (вертикально = тишь, 90° вправо = макс)',
    lScale: 'Л · размер — реверберация (ближе = больше)',
    rIndex: 'П · кончик указательного — пентатоническая сетка 5×5',
    rOpenness: 'П · раскрытие — дилей / эхо',
    rPinch: 'П · щипок — тантпура (скоро)',
    activeSample: 'Активный семпл',
    nameLabel: 'Название:',
    baseNoteLabel: 'Базовая нота:',
    fileLabel: 'Файл:',
    noSampleLoaded: 'Семпл не загружен. Семплы загружаются автоматически из',
    onPageLoad: 'при загрузке страницы.',
    status: 'Статус',
    trackingReady: 'Трекинг готов:',
    audioStartedLabel: 'Звук запущен:',
    handsVisible: 'Руки видны:',
    harpGate: 'Гейт арфы:',
    yes: 'да',
    no: 'нет',
    open: 'открыт',
    closed: 'закрыт',

    clickToBegin: 'Нажмите «Запустить звук», чтобы начать',
    browserGesture:
      'Мы требуем жеста пользователя перед воспроизведением звука. После клика пэд-движок запустится в фоне и арфа станет играбельной, как только загрузится семпл.',
  },
};
