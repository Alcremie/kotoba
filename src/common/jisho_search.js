const reload = require('require-reload')(require);
const globals = require('./globals.js');

const jishoWordSearch = reload('./jisho_word_search.js');
const kanjiContentCreator = reload('./kanji_search_content_creator.js');
const strokeOrderContentCreator = reload('./stroke_order_content_creator.js');
const examplesContentCreator = reload('./examples_content_creator.js');
const constants = reload('./constants.js');
const JishoDiscordContentFormatter = reload('./jisho_discord_content_formatter.js');
const {
  NavigationPage,
  NavigationChapter,
  Navigation,
} = reload('monochrome-bot');

const KANJI_REGEX = /[\u4e00-\u9faf\u3400-\u4dbf]/g;
const STROKE_ORDER_EMOTE = '🇸';
const KANJI_EMOTE = '🇰';
const EXAMPLES_EMOTE = '🇪';
const JISHO_EMOTE = '🇯';

function addFooter(authorName, content) {
  if (!content) {
    return undefined;
  }

  const contentCopy = Object.assign({}, content);
  contentCopy.embed = Object.assign({}, content.embed);

  contentCopy.embed.footer = {
    icon_url: constants.FOOTER_ICON_URI,
    text: `${authorName} can use the reaction buttons below to see more information!`,
  };

  return contentCopy;
}

class NavigationChapterInformation {
  constructor(navigationChapter, hasMultiplePages, hasAnyPages) {
    this.navigationChapter = navigationChapter;
    this.hasMultiplePages = hasMultiplePages;
    this.hasAnyPages = hasAnyPages;
  }
}

class StrokeOrderDataSource {
  constructor(authorName, kanjis, isStandalone, hasMultiplePages) {
    this.kanjis = kanjis;
    this.authorName = authorName;
    this.isStandalone = isStandalone;
    this.hasMultiplePages = hasMultiplePages;
  }

  // Nothing to do here, but we need the method due to
  // interface contract.
  // eslint-disable-next-line class-methods-use-this
  prepareData() {
  }

  async getPageFromPreparedData(arg, pageIndex) {
    if (pageIndex < this.kanjis.length) {
      const content = await strokeOrderContentCreator.createContent(this.kanjis[pageIndex]);
      if (this.hasMultiplePages || !this.isStandalone) {
        return new NavigationPage(addFooter(this.authorName, content));
      }
      return new NavigationPage(content);
    }

    return undefined;
  }
}

class KanjiDataSource {
  constructor(authorName, kanjis, isStandalone, hasMultiplePages, prefix) {
    this.kanjis = kanjis;
    this.authorName = authorName;
    this.isStandalone = isStandalone;
    this.hasMultiplePages = hasMultiplePages;
    this.prefix = prefix;
  }

  // Nothing to do here, but we need the method due to
  // interface contract.
  // eslint-disable-next-line class-methods-use-this
  prepareData() {
  }

  async getPageFromPreparedData(arg, pageIndex) {
    if (pageIndex < this.kanjis.length) {
      const content = await kanjiContentCreator.createContent(this.kanjis[pageIndex], this.prefix);
      if (this.hasMultiplePages || !this.isStandalone) {
        return new NavigationPage(addFooter(this.authorName, content));
      }
      return new NavigationPage(content);
    }

    return undefined;
  }
}

class ExamplesSource {
  constructor(authorName, word, isStandalone) {
    this.word = word;
    this.authorName = authorName;
    this.isStandalone = isStandalone;
  }

  prepareData() {
    return examplesContentCreator.createContent(this.word);
  }

  getPageFromPreparedData(arg, pageIndex) {
    let content = arg.toDiscordBotContent(pageIndex);
    let showPageArrows = false;
    if ((content && content.pages > 1) || !this.isStandalone) {
      content = addFooter(this.authorName, content);
      showPageArrows = true;
    }

    const page = new NavigationPage(content);
    page.showPageArrows = showPageArrows;

    return page;
  }
}

function removeDuplicates(array) {
  if (!array) {
    return undefined;
  }

  return array.filter((element, i) => array.indexOf(element) === i);
}

function createNavigationChapterInformationForKanji(authorName, word, isStandalone, prefix) {
  const kanjis = removeDuplicates(word.match(KANJI_REGEX));
  const pageCount = kanjis ? kanjis.length : 0;
  const hasMultiplePages = pageCount > 1;
  const hasAnyPages = pageCount > 0;
  let navigationChapter;

  if (kanjis && kanjis.length > 0) {
    navigationChapter = new NavigationChapter(new KanjiDataSource(
      authorName,
      kanjis,
      isStandalone,
      hasMultiplePages,
      prefix,
    ));
  } else if (isStandalone) {
    navigationChapter = new NavigationChapter(new KanjiDataSource(
      authorName,
      word,
      isStandalone,
      hasMultiplePages,
      prefix,
    ));
  }

  return new NavigationChapterInformation(navigationChapter, hasMultiplePages, hasAnyPages);
}

function createNavigationChapterInformationForStrokeOrder(authorName, word, isStandalone) {
  const kanjis = removeDuplicates(word.match(KANJI_REGEX));
  const pageCount = kanjis ? kanjis.length : 0;
  const hasMultiplePages = pageCount > 1;
  const hasAnyPages = pageCount > 0;
  let navigationChapter;

  if (kanjis && kanjis.length > 0) {
    navigationChapter = new NavigationChapter(new StrokeOrderDataSource(
      authorName,
      kanjis,
      isStandalone,
      hasMultiplePages,
    ));
  } else if (isStandalone) {
    navigationChapter = new NavigationChapter(new StrokeOrderDataSource(
      authorName,
      word,
      isStandalone,
      hasMultiplePages,
    ));
  }

  return new NavigationChapterInformation(navigationChapter, hasMultiplePages, hasAnyPages);
}

function createNavigationChapterInformationForExamples(authorName, word, isStandalone) {
  const navigationChapter = new NavigationChapter(new ExamplesSource(
    authorName,
    word,
    isStandalone,
  ));

  return new NavigationChapterInformation(navigationChapter);
}

function createNavigationForExamples(msg, authorName, authorId, word, navigationManager) {
  const navigationChapterInformation =
    createNavigationChapterInformationForExamples(authorName, word, true);

  const chapterForEmojiName = {};
  chapterForEmojiName[EXAMPLES_EMOTE] = navigationChapterInformation.navigationChapter;
  const navigation = new Navigation(authorId, true, EXAMPLES_EMOTE, chapterForEmojiName);

  return navigationManager.register(navigation, constants.NAVIGATION_EXPIRATION_TIME, msg);
}

function createNavigationForStrokeOrder(msg, authorName, authorId, kanji, navigationManager) {
  const navigationChapterInformation = createNavigationChapterInformationForStrokeOrder(
    authorName,
    kanji,
    true,
  );

  const chapterForEmojiName = {};
  chapterForEmojiName[STROKE_ORDER_EMOTE] = navigationChapterInformation.navigationChapter;

  const navigation = new Navigation(
    authorId,
    navigationChapterInformation.hasMultiplePages,
    STROKE_ORDER_EMOTE,
    chapterForEmojiName,
  );

  return navigationManager.register(navigation, constants.NAVIGATION_EXPIRATION_TIME, msg);
}

function createNavigationForKanji(msg, authorName, authorId, kanji, navigationManager, prefix) {
  const navigationChapterInformation = createNavigationChapterInformationForKanji(
    authorName,
    kanji,
    true,
    prefix,
  );

  const chapterForEmojiName = {};
  chapterForEmojiName[KANJI_EMOTE] = navigationChapterInformation.navigationChapter;

  const navigation = new Navigation(
    authorId,
    navigationChapterInformation.hasMultiplePages,
    KANJI_EMOTE,
    chapterForEmojiName,
  );

  return navigationManager.register(navigation, constants.NAVIGATION_EXPIRATION_TIME, msg);
}

function createNavigationForJishoResults(msg, authorName, authorId, crossPlatformResponseData, navigationManager) {
  const word = crossPlatformResponseData.searchPhrase;
  const discordContents = JishoDiscordContentFormatter.formatJishoDataBig(
    crossPlatformResponseData,
    true,
    true,
    authorName,
  );

  const prefix = globals.persistence.getPrimaryPrefixFromMsg(msg);

  // HACK: Remove this after !j alias is deprecated
  if (msg.wasShortJishoAlias) {
    const firstContent = discordContents[0];
    firstContent.content = 'The **!j** command alias is scheduled to stop working around 7/1. Please start using **k!j**, or ask a server admin to add **!** to my list of prefixes by saying **k!settings prefixes k! !** or by using the **k!settings** command menu. Say **k!about** to get a link to my support server for additional help.';
  }

  const jishoNavigationChapter = NavigationChapter.fromContent(discordContents);
  const chapterForEmojiName = {};
  chapterForEmojiName[JISHO_EMOTE] = jishoNavigationChapter;

  const kanjiNavigationChapterInformation = createNavigationChapterInformationForKanji(
    authorName,
    word,
    false,
    prefix,
  );
  if (kanjiNavigationChapterInformation.hasAnyPages) {
    chapterForEmojiName[KANJI_EMOTE] =
      kanjiNavigationChapterInformation.navigationChapter;
  }

  const strokeOrderNavigationChapterInformation = createNavigationChapterInformationForStrokeOrder(
    authorName,
    word,
    false,
  );
  if (strokeOrderNavigationChapterInformation.hasAnyPages) {
    chapterForEmojiName[STROKE_ORDER_EMOTE] =
      strokeOrderNavigationChapterInformation.navigationChapter;
  }

  const examplesNavigationChapter = createNavigationChapterInformationForExamples(
    authorName,
    word,
    false,
  ).navigationChapter;
  chapterForEmojiName[EXAMPLES_EMOTE] = examplesNavigationChapter;

  const navigation = new Navigation(authorId, true, JISHO_EMOTE, chapterForEmojiName);
  return navigationManager.register(navigation, constants.NAVIGATION_EXPIRATION_TIME, msg);
}

async function createOnePageBigResultForWord(msg, word) {
  const crossPlatformResponseData = await jishoWordSearch(word);
  const discordContents = JishoDiscordContentFormatter.formatJishoDataBig(
    crossPlatformResponseData,
    false,
  );

  const response = discordContents[0];
  return msg.channel.createMessage(response, null, msg);
}

async function createNavigationForWord(authorName, authorId, word, msg, navigationManager) {
  const crossPlatformResponseData = await jishoWordSearch(word);
  return createNavigationForJishoResults(
    msg,
    authorName,
    authorId,
    crossPlatformResponseData,
    navigationManager,
    globals.persistence.getPrimaryPrefixFromMsg(msg),
  );
}

async function createSmallResultForWord(msg, word) {
  const crossPlatformResponseData = await jishoWordSearch(word);
  const discordContent =
    JishoDiscordContentFormatter.formatJishoDataSmall(crossPlatformResponseData);

  return msg.channel.createMessage(discordContent, null, msg);
}

module.exports = {
  createNavigationForWord,
  createNavigationForJishoResults,
  createNavigationForKanji,
  createNavigationForStrokeOrder,
  createNavigationForExamples,
  createSmallResultForWord,
  createOnePageBigResultForWord,
};
