import { normalizeTerm } from './normalize-term';

const ES_STOPWORDS_RAW: readonly string[] = [
  'a', 'al', 'algo', 'algunas', 'algunos', 'ante', 'antes', 'como', 'con', 'contra',
  'cual', 'cuando', 'de', 'del', 'desde', 'donde', 'durante', 'e', 'el', 'ella',
  'ellas', 'ellos', 'en', 'entre', 'era', 'erais', 'eran', 'eres', 'es', 'esa',
  'esas', 'ese', 'eso', 'esos', 'esta', 'estaba', 'estado', 'estamos', 'están', 'estar',
  'este', 'esto', 'estos', 'fue', 'fueron', 'fui', 'fuimos', 'ha', 'hace', 'hacen',
  'hacer', 'hacia', 'han', 'hasta', 'hay', 'la', 'las', 'le', 'les', 'lo',
  'los', 'más', 'me', 'mi', 'mis', 'mucho', 'muy', 'nada', 'ni', 'no',
  'nos', 'nosotros', 'o', 'otra', 'otro', 'para', 'pero', 'poco', 'por', 'porque',
  'que', 'quien', 'se', 'ser', 'si', 'sin', 'sobre', 'solo', 'somos', 'son',
  'soy', 'su', 'sus', 'también', 'tanto', 'te', 'tiene', 'tienen', 'todo', 'todos',
  'tu', 'tus', 'un', 'una', 'uno', 'unos', 'y', 'ya', 'yo',
];

const EN_STOPWORDS_RAW: readonly string[] = [
  'a', 'about', 'after', 'all', 'also', 'an', 'and', 'any', 'are', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'between', 'but', 'by', 'can',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
  'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no',
  'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so',
  'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
  'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until',
  'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while',
  'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your', 'yours', 'yourself',
  'yourselves',
];

export const ES_STOPWORDS: ReadonlySet<string> = new Set(ES_STOPWORDS_RAW.map(normalizeTerm));
export const EN_STOPWORDS: ReadonlySet<string> = new Set(EN_STOPWORDS_RAW.map(normalizeTerm));

const STOPWORDS_BY_BASE_LANGUAGE: Readonly<Record<string, ReadonlySet<string>>> = {
  es: ES_STOPWORDS,
  en: EN_STOPWORDS,
};

export interface ResolvedStopwords {
  readonly language: string | null;
  readonly terms: ReadonlySet<string>;
}

function baseSubtagOf(language: string): string {
  const separatorIndex = language.indexOf('-');
  return separatorIndex === -1 ? language : language.slice(0, separatorIndex);
}

export function resolveStopwords(language: string): ResolvedStopwords {
  const baseLanguage = baseSubtagOf(language);
  const terms = STOPWORDS_BY_BASE_LANGUAGE[baseLanguage];

  if (terms === undefined) {
    return { language: null, terms: new Set() };
  }

  return { language: baseLanguage, terms };
}
