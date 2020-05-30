const assert = require('assert');
const startSequences = require('./shiritori_word_starting_sequences.js');
const convertToHiragana = require('./../convert_to_hiragana.js');

const REJECTION_REASON = {
  UnknownWord: 'Unknown word',
  ReadingAlreadyUsed: 'Reading already used',
  ReadingEndsWithN: 'Reading ends with N',
  WrongStartSequence: 'Does not start with the right characters',
  NotNoun: 'Not a noun',
};

const largeHiraganaForSmallHiragana = {
  ゃ: 'や',
  ゅ: 'ゆ',
  ょ: 'よ',
  ぁ: 'あ',
  ぃ: 'い',
  ぅ: 'う',
  ぇ: 'え',
  ぉ: 'お',
};

function getNextWordMustStartWith(currentWordReading) {
  const finalCharacter = currentWordReading[currentWordReading.length - 1];
  if (finalCharacter === 'ぢ') {
    return ['じ', 'ぢ'];
  } if (finalCharacter === 'づ') {
    return ['ず', 'づ'];
  } if (finalCharacter === 'を') {
    return ['お', 'を'];
  } if (!largeHiraganaForSmallHiragana[finalCharacter]) {
    return [finalCharacter];
  }
  return [
    largeHiraganaForSmallHiragana[finalCharacter],
    currentWordReading.substring(currentWordReading.length - 2, currentWordReading.length),
  ];
}

class WordInformation {
  constructor(word, reading, meaning) {
    this.word = word;
    this.reading = reading;
    this.meaning = meaning;
    this.nextWordMustStartWith = getNextWordMustStartWith(this.reading);
    this.uri = `https://jisho.org/search/${encodeURIComponent(this.word)}`;
  }
}

class AcceptedResult {
  constructor(word, reading, meaning, score) {
    this.accepted = true;
    this.score = score;
    this.word = new WordInformation(word, reading, meaning);
  }
}

class RejectedResult {
  constructor(reason, extraData) {
    this.accepted = false;
    this.rejectionReason = reason;
    this.extraData = extraData;
  }
}

function getRandomArrayElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function readingAlreadyUsed(reading, wordInformationsHistory) {
  return wordInformationsHistory.some(wordInformation => wordInformation.reading === reading);
}

function pushUnique(array, element) {
  if (array.indexOf(element) === -1) {
    array.push(element);
  }
}

class JapaneseGameStrategy {
  constructor(resourceDatabase) {
    this.resourceDatabase = resourceDatabase;
  }

  async tryAcceptAnswer(answer, wordInformationsHistory) {
    const hiragana = convertToHiragana(answer);
    const possibleWordInformations = await this.resourceDatabase.getShiritoriWords(hiragana);
  
    if (!possibleWordInformations || possibleWordInformations.length === 0) {
      return new RejectedResult(REJECTION_REASON.UnknownWord);
    }
  
    let nextWordStartSequences;
    if (wordInformationsHistory.length > 0) {
      const previousWordInformation = wordInformationsHistory[wordInformationsHistory.length - 1];
      nextWordStartSequences = previousWordInformation.nextWordMustStartWith;
    }
  
    const alreadyUsedReadings = [];
    const readingsEndingWithN = [];
    const readingsStartingWithWrongSequence = [];
    const noNounReadings = [];
    let readingToUse;
    let answerToUse;
    let meaningToUse;
    for (let i = 0; i < possibleWordInformations.length; i += 1) {
      const possibleWordInformation = possibleWordInformations[i];
      const { reading } = possibleWordInformation;
      const alreadyUsed = readingAlreadyUsed(reading, wordInformationsHistory);
      if (
        nextWordStartSequences
        && !nextWordStartSequences.some(sequence => reading.startsWith(sequence))
      ) {
        pushUnique(readingsStartingWithWrongSequence, reading);
      } else if (reading.endsWith('ん')) {
        pushUnique(readingsEndingWithN, reading);
      } else if (alreadyUsed) {
        pushUnique(alreadyUsedReadings, reading);
      } else if (!possibleWordInformation.isNoun) {
        pushUnique(noNounReadings, reading);
      } else {
        readingToUse = reading;
        answerToUse = possibleWordInformation.word;
        if (possibleWordInformation.definitions) {
          meaningToUse = possibleWordInformation.definitions.join(', ');
        }
        break;
      }
    }
  
    if (answerToUse) {
      return new AcceptedResult(answerToUse, readingToUse, meaningToUse, readingToUse.length);
    }
  
    if (alreadyUsedReadings.length > 0) {
      return new RejectedResult(REJECTION_REASON.ReadingAlreadyUsed, alreadyUsedReadings);
    } if (readingsEndingWithN.length > 0) {
      return new RejectedResult(REJECTION_REASON.ReadingEndsWithN, readingsEndingWithN);
    } if (readingsStartingWithWrongSequence.length > 0) {
      return new RejectedResult(
        REJECTION_REASON.WrongStartSequence,
        {
          expected: nextWordStartSequences,
          actual: readingsStartingWithWrongSequence,
        },
      );
    } if (noNounReadings.length > 0) {
      return new RejectedResult(REJECTION_REASON.NotNoun, noNounReadings);
    }
  
    assert(false, 'Unexpected branch');
    return undefined;
  }
  
  async getViableNextResult(wordInformationsHistory) {
    let startSequence;
    if (wordInformationsHistory.length > 0) {
      const previousWordInformation = wordInformationsHistory[wordInformationsHistory.length - 1];
      ([startSequence] = previousWordInformation.nextWordMustStartWith);
    } else {
      startSequence = getRandomArrayElement(startSequences);
    }
  
    const readingsForStartSequence = require('./readings_for_start_sequence.json');
    const possibleNextReadings = readingsForStartSequence[startSequence];
  
    // Cube it in order to prefer more common words.
    const cubeRandom = Math.random() * Math.random() * Math.random();
    let nextReadingIndex = Math.floor(cubeRandom * possibleNextReadings.length);
    const firstReadingTestedIndex = nextReadingIndex;
  
    // Find a word that is usable and return it.
    while (true) {
      const nextReading = possibleNextReadings[nextReadingIndex];
      const result = await this.tryAcceptAnswer(nextReading, wordInformationsHistory);
      if (result.accepted) {
        return result;
      }
  
      nextReadingIndex += 1;
      if (nextReadingIndex === possibleNextReadings.length) {
        // Wrap around to the start of the array
        nextReadingIndex = 0;
      }
  
      if (nextReadingIndex === firstReadingTestedIndex) {
        // We came full circle. Couldn't find a viable next word.
        // Should be extremely unlikely to happen as a game would need
        // to continue for a very long time for us to run out of usable
        // words
        throw new Error('Could not find a viable next word');
      }
    }
  }
}

module.exports = JapaneseGameStrategy;
module.exports.REJECTION_REASON = REJECTION_REASON;
