import type { Locale } from './types';
import { DEFAULT_LOCALE, parseLocale } from './types';

type PromptText = Record<Locale, string>;

function pick(locale: string | undefined, texts: PromptText): string {
  return texts[parseLocale(locale)];
}

export function getQueryTableUserMessage(
  locale: string | undefined,
  _tableName: string,
  _limit: number
): string {
  return pick(locale, {
    en:
      'Show the top 7 product groups, including the number of products in each group. ' +
      'Also add a computed field: the percentage of products in each group relative to the total number of products in these groups.',
    ru:
      'Покажи топ 7 групп товаров, включая количество товаров в каждой группе. ' +
      'Также добавь вычисляемое поле: процент товаров в каждой группе относительно общего количества товаров в этих группах.',
    by:
      'Пакажы топ 7 груп тавараў, уключаючы колькасць тавараў у кожнай групе. ' +
      'Таксама дадай вылічальнае поле: працэнт тавараў у кожнай групе адносна агульнай колькасці тавараў у гэтых групах.',
  });
}

export function getBasicPrompt(locale: string | undefined): string {
  return pick(locale, {
    en: 'Show me the full forecast with temperature, chance of precipitation, cloud cover, etc. in London',
    ru: 'Покажи полный прогноз с температурой, вероятностью осадков, облачностью и т.д. для Лондона',
    by: 'Пакажы поўны прагноз з тэмпературай, верагоднасцю ападкаў, воблачнасцю і г.д. для Лондана',
  });
}

export function getRainProbabilityPrompt(locale: string | undefined): string {
  return pick(locale, {
    en: 'What is the probability of rain in London today?',
    ru: 'Какова вероятность дождя в Лондоне сегодня?',
    by: 'Якая верагоднасць дажджу ў Лондане сёння?',
  });
}

export function getTemperaturePrompt(locale: string | undefined): string {
  return pick(locale, {
    en: 'What is the temperature in Minsk today?',
    ru: 'Какая температура в Минске сегодня?',
    by: 'Якая тэмпература ў Мінску сёння?',
  });
}

export function getGreetingTemplate(
  locale: string | undefined,
  name: string
): string {
  return pick(locale, {
    en: `Please greet ${name} in a friendly manner and add a sign BigTeam in the end of the message.`,
    ru: `Поприветствуй ${name} дружелюбно и добавь подпись BigTeam в конце сообщения.`,
    by: `Прывітай ${name} сяброўскі і дадай подпіс BigTeam у канцы паведамлення.`,
  });
}

export function getBirthdayCongratulations(
  locale: string | undefined,
  name: string,
  age: string
): string {
  return pick(locale, {
    en: `Please congratulate ${name} on their birthday. They are ${age} years old.`,
    ru: `Поздравь ${name} с днём рождения. Ему/ей ${age} лет.`,
    by: `Павінуй ${name} з днём нараджэння. Яму/ёй ${age} гадоў.`,
  });
}

export const LOCALE_ARG_SCHEMA = ['en', 'ru', 'by'] as const;

export { DEFAULT_LOCALE };
