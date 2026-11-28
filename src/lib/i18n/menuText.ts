import type { AppLang } from "@/lib/voice/langPref";
import { useAppLang } from "./appLang";

/**
 * The map's Layers menu and the You card (settings, what we remember, the pages
 * that left the map), in the same language as the rest of the app's own text. Kept apart
 * from appLang.ts so the agent overlay does not carry the menu's words.
 */
type Key =
  | "cityData" | "settings" | "you" | "more" | "whatWeRemember" | "cityDataSub" | "recordWalk" | "whatsComing" | "shareApp" | "aboutProject"
  | "liveTrains" | "liveBuses" | "restrooms"
  | "stationsOnly" | "busStops" | "streetNames" | "buildings3d"
  | "remembered" | "countOf" | "yourData" | "seeAll" | "nothingKept" | "dataPolicy" | "policyText" | "tapAgain" | "deleted" | "deleteEverything"
  | "rides" | "homeWork" | "chats" | "trips" | "exactLocation"
  | "crashes311" | "dataLayers" | "aboutData"
  | "language" | "thisPhone" | "speakAnswers" | "voice" | "appVoice" | "phoneVoice" | "listenHeyMap" | "theme" | "auto" | "lighting" | "day" | "night"
  | "weather" | "live" | "clear" | "off" | "city3d" | "eco" | "advanced" | "trackerHealth" | "presenter" | "model" | "elevatorsOnly";

const T: Record<AppLang, Record<Key, string>> = {
  en: {
    cityData: "City data", settings: "Settings", you: "You", more: "More", whatWeRemember: "What we remember", cityDataSub: "311, noise, crashes", recordWalk: "Record a station walk", whatsComing: "What's coming", shareApp: "Share this app", aboutProject: "About this project",
    liveTrains: "Live trains", liveBuses: "Live buses", restrooms: "Restrooms",
    stationsOnly: "Stations only", busStops: "Bus stops", streetNames: "Street names", buildings3d: "3D buildings",
    remembered: "Remembered", countOf: "{n} of {m}", yourData: "Your data", seeAll: "See all", nothingKept: "Nothing kept", dataPolicy: "Data policy",
    policyText: "What you save stays on this phone. Your location goes with a question only while you share it, and the AI model never gets it as numbers. Delete everything clears it all.", tapAgain: "Tap again to delete everything", deleted: "Deleted", deleteEverything: "Delete everything",
    rides: "Daily rides", homeWork: "Home & Work", chats: "Chats · 30 days", trips: "Trips looked up", exactLocation: "Exact location",
    crashes311: "311 and crashes", dataLayers: "Data layers", aboutData: "About the data",
    language: "Language", thisPhone: "This phone", speakAnswers: "Speak answers", voice: "Voice", appVoice: "App voice", phoneVoice: "My phone’s voice", listenHeyMap: "Listen for “Hey map”", theme: "Theme", auto: "Auto", lighting: "Lighting", day: "Day", night: "Night",
    weather: "Weather", live: "Live", clear: "Clear", off: "Off", city3d: "Textured 3D city", eco: "Eco mode", advanced: "Advanced", trackerHealth: "Tracker health", presenter: "Meet Design Baker", model: "Model", elevatorsOnly: "Elevators only",
  },
  es: {
    cityData: "Datos de la ciudad", settings: "Ajustes", you: "Tú", more: "Más", whatWeRemember: "Lo que recordamos", cityDataSub: "311, ruido, choques", recordWalk: "Grabar un recorrido por la estación", whatsComing: "Lo que viene", shareApp: "Compartir esta app", aboutProject: "Sobre este proyecto",
    liveTrains: "Trenes en vivo", liveBuses: "Autobuses en vivo", restrooms: "Baños",
    stationsOnly: "Solo estaciones", busStops: "Paradas de autobús", streetNames: "Nombres de calles", buildings3d: "Edificios 3D",
    remembered: "Recordado", countOf: "{n} de {m}", yourData: "Tus datos", seeAll: "Ver todo", nothingKept: "Nada guardado", dataPolicy: "Política de datos",
    policyText: "Lo que guardas se queda en este teléfono. Tu ubicación va con una pregunta solo mientras la compartes, y el modelo de IA nunca la recibe en números. Borrar todo lo elimina todo.", tapAgain: "Toca otra vez para borrar todo", deleted: "Borrado", deleteEverything: "Borrar todo",
    rides: "Viajes diarios", homeWork: "Casa y trabajo", chats: "Chats · 30 días", trips: "Viajes buscados", exactLocation: "Ubicación exacta",
    crashes311: "311 y choques", dataLayers: "Capas de datos", aboutData: "Sobre los datos",
    language: "Idioma", thisPhone: "Este teléfono", speakAnswers: "Leer respuestas en voz alta", voice: "Voz", appVoice: "Voz de la app", phoneVoice: "Voz de mi teléfono", listenHeyMap: "Escuchar “Oye mapa”", theme: "Tema", auto: "Automático", lighting: "Luz", day: "Día", night: "Noche",
    weather: "Clima", live: "En vivo", clear: "Despejado", off: "Apagado", city3d: "Ciudad 3D con texturas", eco: "Modo ahorro", advanced: "Avanzado", trackerHealth: "Estado del rastreo", presenter: "Conoce a Design Baker", model: "Modelo", elevatorsOnly: "Solo ascensores",
  },
  zh: {
    cityData: "城市数据", settings: "设置", you: "我", more: "更多", whatWeRemember: "我们记住的内容", cityDataSub: "311、噪音、事故", recordWalk: "录制车站步行路线", whatsComing: "即将推出", shareApp: "分享此应用", aboutProject: "关于本项目",
    liveTrains: "实时列车", liveBuses: "实时公交", restrooms: "厕所",
    stationsOnly: "只看车站", busStops: "公交站", streetNames: "街道名", buildings3d: "3D 建筑",
    remembered: "已记住", countOf: "{n} / {m}", yourData: "你的数据", seeAll: "全部查看", nothingKept: "没有保存任何内容", dataPolicy: "数据政策",
    policyText: "你保存的内容只留在这部手机上。只有在你分享位置时，位置才会随问题发送，AI 模型永远拿不到具体坐标。“删除全部”会清除所有内容。", tapAgain: "再点一次删除全部", deleted: "已删除", deleteEverything: "删除全部",
    rides: "日常乘车", homeWork: "家和公司", chats: "对话 · 30 天", trips: "查过的行程", exactLocation: "精确位置",
    crashes311: "311 和交通事故", dataLayers: "数据图层", aboutData: "关于数据",
    language: "语言", thisPhone: "跟随手机", speakAnswers: "朗读回答", voice: "语音", appVoice: "应用语音", phoneVoice: "手机自带语音", listenHeyMap: "听“嘿地图”", theme: "主题", auto: "自动", lighting: "光线", day: "白天", night: "夜晚",
    weather: "天气", live: "实时", clear: "晴天", off: "关闭", city3d: "带纹理的 3D 城市", eco: "省电模式", advanced: "高级", trackerHealth: "追踪器状态", presenter: "认识 Design Baker", model: "模型", elevatorsOnly: "仅乘电梯",
  },
  ru: {
    cityData: "Данные города", settings: "Настройки", you: "Вы", more: "Ещё", whatWeRemember: "Что мы запоминаем", cityDataSub: "311, шум, аварии", recordWalk: "Записать проход по станции", whatsComing: "Что будет дальше", shareApp: "Поделиться приложением", aboutProject: "О проекте",
    liveTrains: "Поезда сейчас", liveBuses: "Автобусы сейчас", restrooms: "Туалеты",
    stationsOnly: "Только станции", busStops: "Остановки автобусов", streetNames: "Названия улиц", buildings3d: "3D-здания",
    remembered: "Запомнено", countOf: "{n} из {m}", yourData: "Ваши данные", seeAll: "Показать всё", nothingKept: "Ничего не сохранено", dataPolicy: "Политика данных",
    policyText: "Сохранённое остаётся на этом телефоне. Ваше местоположение отправляется с вопросом, только пока вы им делитесь, а модель ИИ никогда не получает его координаты. «Удалить всё» стирает всё.", tapAgain: "Нажмите ещё раз, чтобы удалить всё", deleted: "Удалено", deleteEverything: "Удалить всё",
    rides: "Ежедневные поездки", homeWork: "Дом и работа", chats: "Чаты · 30 дней", trips: "Найденные маршруты", exactLocation: "Точное место",
    crashes311: "311 и аварии", dataLayers: "Слои данных", aboutData: "О данных",
    language: "Язык", thisPhone: "Как на телефоне", speakAnswers: "Озвучивать ответы", voice: "Голос", appVoice: "Голос приложения", phoneVoice: "Голос телефона", listenHeyMap: "Слушать «Эй, карта»", theme: "Тема", auto: "Авто", lighting: "Освещение", day: "День", night: "Ночь",
    weather: "Погода", live: "Сейчас", clear: "Ясно", off: "Выкл.", city3d: "3D-город с текстурами", eco: "Эко-режим", advanced: "Расширенные", trackerHealth: "Состояние трекера", presenter: "Знакомство с Design Baker", model: "Модель", elevatorsOnly: "Только лифты",
  },
  bn: {
    cityData: "শহরের ডেটা", settings: "সেটিংস", you: "আপনি", more: "আরও", whatWeRemember: "আমরা যা মনে রাখি", cityDataSub: "311, শব্দ, দুর্ঘটনা", recordWalk: "স্টেশনে হাঁটা রেকর্ড করুন", whatsComing: "যা আসছে", shareApp: "এই অ্যাপ শেয়ার করুন", aboutProject: "এই প্রকল্প সম্পর্কে",
    liveTrains: "লাইভ ট্রেন", liveBuses: "লাইভ বাস", restrooms: "টয়লেট",
    stationsOnly: "শুধু স্টেশন", busStops: "বাস স্টপ", streetNames: "রাস্তার নাম", buildings3d: "3D ভবন",
    remembered: "মনে রাখা", countOf: "{m}টির মধ্যে {n}", yourData: "আপনার ডেটা", seeAll: "সব দেখুন", nothingKept: "কিছুই রাখা নেই", dataPolicy: "ডেটা নীতি",
    policyText: "আপনি যা সংরক্ষণ করেন তা এই ফোনেই থাকে। আপনি অবস্থান শেয়ার করলেই কেবল তা প্রশ্নের সঙ্গে যায়, আর AI মডেল কখনও এর স্থানাঙ্ক পায় না। “সব মুছুন” চাপলে সব মুছে যায়।", tapAgain: "সব মুছতে আবার চাপুন", deleted: "মুছে ফেলা হয়েছে", deleteEverything: "সব মুছুন",
    rides: "প্রতিদিনের যাত্রা", homeWork: "বাসা ও কাজ", chats: "চ্যাট · ৩০ দিন", trips: "খোঁজা যাত্রা", exactLocation: "সঠিক অবস্থান",
    crashes311: "311 ও দুর্ঘটনা", dataLayers: "ডেটা স্তর", aboutData: "ডেটা সম্পর্কে",
    language: "ভাষা", thisPhone: "এই ফোনের মতো", speakAnswers: "উত্তর বলে শোনান", voice: "কণ্ঠস্বর", appVoice: "অ্যাপের কণ্ঠস্বর", phoneVoice: "আমার ফোনের কণ্ঠস্বর", listenHeyMap: "“হেই ম্যাপ” শুনুন", theme: "থিম", auto: "স্বয়ংক্রিয়", lighting: "আলো", day: "দিন", night: "রাত",
    weather: "আবহাওয়া", live: "লাইভ", clear: "পরিষ্কার", off: "বন্ধ", city3d: "টেক্সচারসহ 3D শহর", eco: "ইকো মোড", advanced: "উন্নত", trackerHealth: "ট্র্যাকারের অবস্থা", presenter: "Design Baker-এর সাথে পরিচিত হন", model: "মডেল", elevatorsOnly: "শুধু লিফট",
  },
  ht: {
    cityData: "Done vil la", settings: "Paramèt", you: "Ou", more: "Plis", whatWeRemember: "Sa nou sonje", cityDataSub: "311, bri, aksidan", recordWalk: "Anrejistre yon mache nan estasyon", whatsComing: "Sa k ap vini", shareApp: "Pataje app sa a", aboutProject: "Sou pwojè sa a",
    liveTrains: "Tren an dirèk", liveBuses: "Bis an dirèk", restrooms: "Twalèt",
    stationsOnly: "Estasyon sèlman", busStops: "Arè bis", streetNames: "Non lari", buildings3d: "Bilding 3D",
    remembered: "Sa m sonje", countOf: "{n} sou {m}", yourData: "Done ou", seeAll: "Wè tout", nothingKept: "Pa gen anyen ki sere", dataPolicy: "Règ sou done",
    policyText: "Sa ou sere rete sou telefòn sa a. Pozisyon ou ale ak yon kesyon sèlman pandan w ap pataje l, e modèl AI a pa janm resevwa l an chif. \"Efase tout\" efase tout bagay.", tapAgain: "Peze ankò pou efase tout", deleted: "Efase", deleteEverything: "Efase tout",
    rides: "Vwayaj chak jou", homeWork: "Kay ak travay", chats: "Chat · 30 jou", trips: "Vwayaj ou chèche", exactLocation: "Kote egzak",
    crashes311: "311 ak aksidan", dataLayers: "Kouch done", aboutData: "Sou done yo",
    language: "Lang", thisPhone: "Menm jan ak telefòn nan", speakAnswers: "Li repons yo fò", voice: "Vwa", appVoice: "Vwa aplikasyon an", phoneVoice: "Vwa telefòn mwen", listenHeyMap: "Koute “Hé kat”", theme: "Tèm", auto: "Otomatik", lighting: "Limyè", day: "Jou", night: "Nwit",
    weather: "Tan an", live: "An dirèk", clear: "Klè", off: "Etenn", city3d: "Vil 3D ak teksti", eco: "Mòd ekonomi", advanced: "Avanse", trackerHealth: "Eta swivi a", presenter: "Rankontre Design Baker", model: "Modèl", elevatorsOnly: "Asansè sèlman",
  },
  fr: {
    cityData: "Données de la ville", settings: "Réglages", you: "Vous", more: "Plus", whatWeRemember: "Ce que nous retenons", cityDataSub: "311, bruit, accidents", recordWalk: "Enregistrer un trajet en station", whatsComing: "À venir", shareApp: "Partager l'appli", aboutProject: "À propos du projet",
    liveTrains: "Trains en direct", liveBuses: "Bus en direct", restrooms: "Toilettes",
    stationsOnly: "Stations seulement", busStops: "Arrêts de bus", streetNames: "Noms de rues", buildings3d: "Bâtiments 3D",
    remembered: "Mémorisé", countOf: "{n} sur {m}", yourData: "Vos données", seeAll: "Tout voir", nothingKept: "Rien de gardé", dataPolicy: "Politique des données",
    policyText: "Ce que vous enregistrez reste sur ce téléphone. Votre position part avec une question seulement tant que vous la partagez, et le modèle d’IA ne reçoit jamais ses coordonnées. « Tout effacer » supprime tout.", tapAgain: "Touchez encore pour tout effacer", deleted: "Effacé", deleteEverything: "Tout effacer",
    rides: "Trajets quotidiens", homeWork: "Maison et travail", chats: "Discussions · 30 jours", trips: "Trajets recherchés", exactLocation: "Position exacte",
    crashes311: "311 et accidents", dataLayers: "Calques de données", aboutData: "À propos des données",
    language: "Langue", thisPhone: "Comme le téléphone", speakAnswers: "Lire les réponses", voice: "Voix", appVoice: "Voix de l’appli", phoneVoice: "Voix de mon téléphone", listenHeyMap: "Écouter « Hé carte »", theme: "Thème", auto: "Auto", lighting: "Éclairage", day: "Jour", night: "Nuit",
    weather: "Météo", live: "En direct", clear: "Dégagé", off: "Désactivé", city3d: "Ville 3D texturée", eco: "Mode éco", advanced: "Avancé", trackerHealth: "État du suivi", presenter: "Rencontrer Design Baker", model: "Modèle", elevatorsOnly: "Ascenseurs uniquement",
  },
  ko: {
    cityData: "도시 데이터", settings: "설정", you: "나", more: "더 보기", whatWeRemember: "기억하는 내용", cityDataSub: "311, 소음, 사고", recordWalk: "역 안 걷기 녹화", whatsComing: "곧 나올 기능", shareApp: "이 앱 공유", aboutProject: "이 프로젝트 소개",
    liveTrains: "실시간 열차", liveBuses: "실시간 버스", restrooms: "화장실",
    stationsOnly: "역만 보기", busStops: "버스 정류장", streetNames: "거리 이름", buildings3d: "3D 건물",
    remembered: "기억한 항목", countOf: "{m}개 중 {n}개", yourData: "내 데이터", seeAll: "모두 보기", nothingKept: "저장된 것 없음", dataPolicy: "데이터 정책",
    policyText: "저장한 내용은 이 휴대폰에만 남습니다. 위치는 공유하는 동안에만 질문과 함께 전송되며, AI 모델은 좌표를 받지 않습니다. '모두 삭제'를 누르면 전부 지워집니다.", tapAgain: "한 번 더 누르면 모두 삭제", deleted: "삭제됨", deleteEverything: "모두 삭제",
    rides: "매일 타는 노선", homeWork: "집과 직장", chats: "대화 · 30일", trips: "찾아본 경로", exactLocation: "정확한 위치",
    crashes311: "311 및 사고", dataLayers: "데이터 레이어", aboutData: "데이터 안내",
    language: "언어", thisPhone: "휴대폰 설정", speakAnswers: "답변 읽어 주기", voice: "음성", appVoice: "앱 음성", phoneVoice: "내 휴대폰 음성", listenHeyMap: "“헤이 맵” 듣기", theme: "테마", auto: "자동", lighting: "조명", day: "낮", night: "밤",
    weather: "날씨", live: "실시간", clear: "맑음", off: "끄기", city3d: "질감 있는 3D 도시", eco: "절약 모드", advanced: "고급", trackerHealth: "추적기 상태", presenter: "Design Baker 만나기", model: "모델", elevatorsOnly: "엘리베이터만",
  },
};

export type MenuKey = Key;

/** The menu's text for a key; `{n}`-style holes are filled from `vars`. */
export function menuText(lang: AppLang, key: Key, vars?: Record<string, string | number>): string {
  const s = T[lang][key] ?? T.en[key];
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? "")) : s;
}

/** The menu's text in the current app language, re-rendering when it changes. */
export function useMenuT(): (key: Key, vars?: Record<string, string | number>) => string {
  const lang = useAppLang();
  return (key, vars) => menuText(lang, key, vars);
}
