'use strict'

const SettingsOverride = require('./settings_override.js');

module.exports = {
  serializationIdentifier: 'NORMAL',
  questionLimitOverride: new SettingsOverride(0, false, false, 1, 10000),
  unansweredQuestionLimitOverride: new SettingsOverride(0, false, false, 1, 20),
  answerTimeLimitOverride: new SettingsOverride(0, false, false, 4000, 120000),
  newQuestionDelayAfterUnansweredOverride: new SettingsOverride(0, false, false, 0, 30000),
  newQuestionDelayAfterAnsweredOverride: new SettingsOverride(0, false, false, 0, 30000),
  additionalAnswerWaitTimeOverride: new SettingsOverride(0, false, false, 0, 30000),
  onlyOwnerOrAdminCanStop: false,
  recycleCard: () => false,
  overrideDeckTitle: title => title,
  updateAnswerTimeLimitForUnansweredQuestion: timeLimit => timeLimit,
};
