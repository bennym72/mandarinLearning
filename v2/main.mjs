import { hskLevel1 } from "../modules/hsk1.mjs";
import { hskLevel2 } from "../modules/hsk2.mjs";
import { hskLevel3 } from "../modules/hsk3.mjs";
import { hskLevel4 } from "../modules/hsk4.mjs";

/**
 * Important naming convention
 * Chinese character -> single characters like "有"
 * Chinese compound -> compound consisting of multiple characters like  "一些"
 * Chinese word -> either a character or a compound which has meaning on its own
 */

class ChineseWordModel {

    constructor(json) {
        this.id = json.id;
        this.character = json.character;
        this.character_pinyin = json.character_pinyin;
        this.eng = json.eng;
        this.hsk_level = json.hsk_level;
        this.part_of_speech = json.part_of_speech;
        this.compound_cantonese = json.compound_cantonese;
        this.compound_definition = json.compound_definition;
        this.compound = json.compound;
        this.compound_pinyin = json.compound_pinyin;
    }

    isCharacter() {
        return this.character.length == 1;
    }

    setUnderlyingChar(char) {
        this.underlyingChar = char;
    }

}

class ChineseSentenceModel {

    constructor(chineseWordModel,
        newIdentifier,
        levelForCharacter,
        chineseWord, // this is the chinese word associated to the sentence
        chineseCharacter, // this was the randomly selected character
        underlyingHSKLevel,
        isGroupedCollection
    ) {
        this.character = chineseWordModel.compound;
        this.character_pinyin = chineseWordModel.compound_pinyin;
        this.eng = "";
        this.compound = chineseWordModel.compound_definition;
        this.compound_cantonese = "";
        this.compound_definition = "";
        this.compound_pinyin = "";
        this.hsk_level = "(" + levelForCharacter + " - " + chineseWord,
        this.id = newIdentifier;
        this.part_of_speech = "sentence";
        this.eng_def_for_sentence = chineseWordModel.eng,
        this.underlyingChar = chineseCharacter;
        this.underlyingHSKLevel = underlyingHSKLevel;
        this.isGroupedCollection = isGroupedCollection;
    }

    setOriginalSentenceValue(value) {
        this.originalSentenceValue = value;
    }

    setNumFirstTimeShownValue(value) {
        this.numFirstTimeShownValue = value;
    }

    setNumFirstTimeShownChars(value) {
        this.numFirstTimeShownChars = value;
    }
}


class CharacterMetadata {
    constructor(chineseWordModelsByHskLevelMap, targetLevel) {
        this.chineseWordModelsByHskLevelMap = chineseWordModelsByHskLevelMap;
        this.charsToIgnore = [
            "²",
            "。",
            "，",
            "?",
            "!",
            "！",
            "？",
            " ",
            "、",
            ",",
        ];
        this.targetLevel = targetLevel;
        const hskLevelToCharacterMap = {};
        const hskCharacterToLevelMap = {};
        const hskToUnseenMap = {};
        const singleCharMapToDefinition = {};
        const hskLevelToSingleCharsAsArray = {};
        Object.keys(chineseWordModelsByHskLevelMap).forEach((hskLevel) => {
            Object.keys(chineseWordModelsByHskLevelMap[hskLevel]).forEach((chineseWord) => {
                const chineseWordModel = chineseWordModelsByHskLevelMap[hskLevel][chineseWord];
                if (chineseWordModel.isCharacter()) {
                    if (!hskLevelToCharacterMap[hskLevel]) {
                        hskLevelToCharacterMap[hskLevel] = {};
                    }
                    hskLevelToCharacterMap[hskLevel][chineseWord] = true;
                    if (!hskLevelToSingleCharsAsArray[hskLevel]) {
                        hskLevelToSingleCharsAsArray[hskLevel] = [];
                    }
                    hskLevelToSingleCharsAsArray[hskLevel].push(chineseWord);
                    hskCharacterToLevelMap[chineseWord] = hskLevel;
                    hskToUnseenMap[chineseWord] = true;
                    singleCharMapToDefinition[chineseWord] = chineseWordModel;
                }
            });
        });
        /**
         * {
         *      1:  {
         *          "一" : true,
         *      }
         * }
         */
        this.hskLevelToCharacterMap = hskLevelToCharacterMap;
        /**
         *  {
         *      "一" : 1,
         *  }
         */
        this.hskCharacterToLevelMap = hskCharacterToLevelMap;
        /**
         *  {
         *      "一" : true,
         *  }
         */
        this.hskToUnseenMap = hskToUnseenMap;
        /**
         *  {
         *      "一" : chineseWordModel,
         *  }
         */
        this.singleCharMapToDefinition = singleCharMapToDefinition;

        this.generateValidSentences();
        this.generateSentenceValues();
    }

    // valid sentence generation
    generateValidSentences() {
        // valid sentence maps
        const characterToValidSentenceMap = {};
        // sentence value generation
        const charCountInValidSentences = {};
        this.numTotalValidSentences = 0;
        Object.keys(this.chineseWordModelsByHskLevelMap).forEach((hskLevel) => {
            Object.keys(this.chineseWordModelsByHskLevelMap[hskLevel]).forEach((chineseWord) => {
                const chineseWordModel = this.chineseWordModelsByHskLevelMap[hskLevel][chineseWord];
                if (this.isValidSentence(chineseWordModel.compound, chineseWordModel.character)) {
                    // sentence value generation
                    this.numTotalValidSentences++;
                    const alreadySeen = {};
                    const characters = chineseWordModel.character.split("");
                    characters.forEach((character) => {
                        if (this.isValidCharacter(character) && !alreadySeen[character]) {
                            // valid sentence maps
                            if (!characterToValidSentenceMap[character]) {
                                characterToValidSentenceMap[character] = {};
                            }
                            characterToValidSentenceMap[character][chineseWord] = chineseWordModel;
                            // sentence value generation
                            if (charCountInValidSentences[character]) {
                                charCountInValidSentences[character]++;
                            } else {
                                charCountInValidSentences[character] = 1;
                            }
                            alreadySeen[character] = true;
                        }
                    });
                }
            });
        });
        /**
         * {
         *      "一" : {
         *          "一" : chineseWordModel,
         *          "一些" : chineseWordModel,
         *      }
         * }
         */
        this.characterToValidSentenceMap = characterToValidSentenceMap;
        /**
         *  {
         *      "一" : 20,
         *  }
         */
        this.charCountInValidSentences = charCountInValidSentences;
    }

    isValidSentence(sentence, chineseWord) {
        if (sentence.indexOf(chineseWord) < 0) {
            return false;
        }
        return sentence.split("").every((character) => {
            const characterLevel = this.hskCharacterToLevelMap[character];
            if (!this.isValidCharacter(character)) {
                return true;
            }
            if (characterLevel != null) {
                return characterLevel <= this.targetLevel;
            }
            return false;
        });
    }

    // sentence value generation
    generateSentenceValues() {
        /**
         *  Currently, we randomly select sentences with an even distribution. We take a random character from our pool of candidates, pick a valid sentence, and remove all other characters in that sentence from the pool of characters.
         *  We want this because we prefer random so that we don't end up memorizing sentences.
         *
         *  A character X's likelihood to be picked at the time of selection is 1/# of chars.
         *  A character X's likelihood of being eliminated as a result of another character Y being selected is # of appearances in sentences / # of chars.
         *  
         *  ^^^ this means characters like "我","是"，“不”, etc. are unlikely to ever be picked because they're likely to be eliminated. That means there's no point in generating valuable sentences for these characters.
         *
         *  Each character should have a probabilityPicked score. Probability picked... imagine a character shows up in 4 total sentences (including its own appearance). That means in a single run, we expect it to get picked
         *  1/4 times.
         *
         *  For characters with a high likelihood of being picked, we want to generate valuable sentences.
         *
         *  How do we value a sentence in a measurable way?
         *
         *  1. has to be valid (ie. carries only same HSK level + below)
         *  2. sum of probability to be picked / # of chars
         *  3. We also want to factor in the HSK level (maybe just a multiplier)... ie. a char in HSK 1 can show up in 2/3/4 but a char in HSK 4 can't show up in 1, so we really want to think of an HSK 4 char in a valid sentence as 4x more valuable than an HSK 1.
         *
         *  So what we want to do is find all of the "low value" sentences for high probabilityPicked scores and convert them to higher valued sentences.
        */
        const characterValueInSentences = {};
        Object.keys(this.charCountInValidSentences).forEach((character) => {
            characterValueInSentences[character] = this.roundValue(this.hskCharacterToLevelMap[character] / this.charCountInValidSentences[character]);
        });
        /**
         *  {
         *      "一" : 1.33,
         *  }
         */
        this.characterValueInSentences = characterValueInSentences;
        const chineseWordToSentenceValue = {};
        Object.keys(this.characterToValidSentenceMap).forEach((character) => {
            Object.keys(this.characterToValidSentenceMap[character]).forEach((chineseWord) => {
                const chineseWordModel = this.characterToValidSentenceMap[character][chineseWord];
                let sentenceValue = 0;
                const alreadySeen = {};
                chineseWordModel.compound.split("").forEach((character) => {
                    if (!alreadySeen[character] && this.isValidCharacter(character)) {
                        const charValue = characterValueInSentences[character];
                        if (charValue != null) {
                            sentenceValue += charValue;
                        }
                        alreadySeen[character] = true;
                    }
                });
                chineseWordToSentenceValue[chineseWord] = this.roundValue(sentenceValue / Object.keys(alreadySeen).length);
            });
        });
        /**
         *  {
         *      "一些" : 1.33,
         *  }
         */
        this.chineseWordToSentenceValue = chineseWordToSentenceValue;
    }

    roundValue(value) {
        return Math.round((value + Number.EPSILON) * 1000) / 1000;
    }

    isValidCharacter(character) {
        return this.charsToIgnore.indexOf(character) < 0;
    }
}

class SentenceGeneratorLogger {
    constructor() {
        this.loggingData = [];
        this.allUnqualifiedChars = {};
        this.initialSentenceCount = null;
        this.finalSentenceCount = null;;
    }
    
    // Sentence validation

    logAtStep(characterMetadata, stepName, candidatesAtStep, sentencesByHSKLevel, unqualifiedCharacters, chineseCharacterSeenCount, seenCountThreshold) {
        const currentUnqualifiedChars = [];
        Object.keys(unqualifiedCharacters).forEach((unqualifiedCharacter) => {
            if (!this.allUnqualifiedChars[unqualifiedCharacter]) {
                this.allUnqualifiedChars[unqualifiedCharacter] = true;
                currentUnqualifiedChars.push(unqualifiedCharacter);
            }
        })
        
        const allChineseCharacters = JSON.parse(JSON.stringify(candidatesAtStep));

        var charsAtOrBelowSeenCountThreshold = [];
        Object.keys(allChineseCharacters).forEach((character) => {
            if (chineseCharacterSeenCount[character] <= seenCountThreshold) {
                charsAtOrBelowSeenCountThreshold.push(character);
            }
        });

        const hskLevels = Object.keys(sentencesByHSKLevel).sort().reverse();
        var numSentences = 0;
        var numSentencesPerHskLevel = {};
        for (var i = 0; i < hskLevels.length; i++) {
            const hskLevel = hskLevels[i];
            const sentencesForHskLevel = sentencesByHSKLevel[hskLevel];
            numSentencesPerHskLevel[hskLevel] = sentencesForHskLevel.length;
            sentencesForHskLevel.forEach((sentence) => {
                numSentences++;
                const charactersInSentence = sentence.compound.split("");
                for (var charIndex = 0; charIndex < charactersInSentence.length; charIndex++) {
                    const character = charactersInSentence[charIndex];
                    if (characterMetadata.isValidCharacter(character)) {
                        delete allChineseCharacters[character];
                    }
                }
            });
        }
        const unqualifiedCharCountByHSKLevel = {};
        Object.keys(unqualifiedCharacters).forEach((unqualifiedCharacter) => {
            const hskLevel = characterMetadata.hskCharacterToLevelMap[unqualifiedCharacter];
            if (allChineseCharacters[hskLevel]) {
                delete allChineseCharacters[hskLevel][unqualifiedCharacter];
            }
            if (!unqualifiedCharCountByHSKLevel[hskLevel]) {
                unqualifiedCharCountByHSKLevel[hskLevel] = 0;
            }
            unqualifiedCharCountByHSKLevel[hskLevel]++;
        });
        unqualifiedCharCountByHSKLevel.total = Object.keys(unqualifiedCharacters).length;
        let numUnaccountedForChars = 0;
        Object.keys(allChineseCharacters).forEach((hskLevel) => {
            numUnaccountedForChars += allChineseCharacters[hskLevel] ? allChineseCharacters[hskLevel].length : 0;
        });
        if (this.initialSentenceCount == null) {
            this.initialSentenceCount = numSentences;
        }
        if (stepName != "_groupUnqualifiedCharacters") {
            this.finalSentenceCount = numSentences;
        }
        const stats = {
            step : stepName,
            numSentences : numSentences,
            numSentencesPerHskLevel: numSentencesPerHskLevel,
            numUnqualifiedChars : unqualifiedCharCountByHSKLevel,
            numCharsBelowSeenCountThreshold : charsAtOrBelowSeenCountThreshold.length,
            numUnaccountedForChars : numUnaccountedForChars,
            // unaccountedForChars : allChineseCharacters
            // unqualifiedCharactersAtStep : currentUnqualifiedChars
        }
        this.loggingData.push(stats);
    }

    logFinalValidation(characterMetadata, sentences, finalizedUnqualifiedChars) {
        const allChars = JSON.parse(JSON.stringify(characterMetadata.hskCharacterToLevelMap));
        const seenCount = {};
        sentences.forEach((sentenceModel) => {
            sentenceModel.character.split("").forEach((chineseCharacter) => {
                delete allChars[chineseCharacter];
                if (characterMetadata.isValidCharacter(chineseCharacter)) {
                    if (!seenCount[chineseCharacter]) {
                        seenCount[chineseCharacter] = 0;
                    }
                    seenCount[chineseCharacter]++;
                }
            });
        });
        const seenCountNumToCharMap = {};
        Object.keys(seenCount).forEach((chineseChar) => {
            const count = seenCount[chineseChar];
            if (!seenCountNumToCharMap[count]) {
                seenCountNumToCharMap[count] = [];
            }
            seenCountNumToCharMap[count].push(chineseChar);
        })
        const finalizedUnqualifiedCharsByHSKLevel = {};
        var unqualifiedTotal = 0;
        Object.keys(finalizedUnqualifiedChars).forEach((chineseCharacter) => {
            const hskLevel = characterMetadata.hskCharacterToLevelMap[chineseCharacter];
            if (!finalizedUnqualifiedCharsByHSKLevel[hskLevel]) {
                finalizedUnqualifiedCharsByHSKLevel[hskLevel] = [];
            }
            finalizedUnqualifiedCharsByHSKLevel[hskLevel].push(chineseCharacter);
            unqualifiedTotal += 1;
        });
        finalizedUnqualifiedCharsByHSKLevel.total = unqualifiedTotal;

        const result = {
            // seenCount : seenCountNumToCharMap,
            finalizedUnqualifiedChars : finalizedUnqualifiedCharsByHSKLevel,
            unaccountedForChars : allChars,
            initialSentenceCount : this.initialSentenceCount,
            finalSentenceCount : this.finalSentenceCount,
        }
        console.log(JSON.stringify(result,null,4));
        return result;
    }
}

class SentenceGenerator {

    constructor(config) {
        this.seenCountThreshold = config.seenCountThreshold;
        this.numUnseenToKeep = config.numUnseenToKeep;

        const chineseWordModelsByHskLevelMap = config.chineseWordModelsByHskLevelMap;
        const targetLevel = config.targetLevel;
        this.logger = new SentenceGeneratorLogger();
        const chineseWordModelsByHSKLevelMapToUse = {};
        Object.keys(chineseWordModelsByHskLevelMap).forEach((hskLevel) => {
            if (hskLevel <= targetLevel) {
                chineseWordModelsByHSKLevelMapToUse[hskLevel] = chineseWordModelsByHskLevelMap[hskLevel];
            };
        });
        this.characterMetadata = new CharacterMetadata(chineseWordModelsByHSKLevelMapToUse, targetLevel);

        const levelsToInclude = Object.keys(chineseWordModelsByHSKLevelMapToUse).map((value) => { return Number.parseInt(value); });
        levelsToInclude.sort().reverse();
        this.levelsToInclude = levelsToInclude;

        this.chineseCharacterCandidates = {};
        this.chineseCharacterSeenCount = {};
        this.levelsToInclude.forEach((level) => {
            const candidates = Object.keys(this.characterMetadata.hskLevelToCharacterMap[level]);
            candidates.forEach((chineseCharacter) => {
                this.chineseCharacterSeenCount[chineseCharacter] = 0;
            });
            this.chineseCharacterCandidates[level] = JSON.parse(JSON.stringify(this.characterMetadata.hskLevelToCharacterMap[level]));
        });

        this.unqualifiedCharacters = {};
        this.generatedMoreThanOneSetFromUnqualifiedChars = 0;

        this.generatedSentences = this.generateSentences();
    }

    generateSentences() {
        const randomizedChineseCharsByHSKLevel = this._generateRandomizedSentences();
        this._logAtStep("_generateRandomizedSentences", this.characterMetadata.hskCharacterToLevelMap, randomizedChineseCharsByHSKLevel);
        const filteredRandomizedChineseCharsByHskLevel = this._filterSentences(randomizedChineseCharsByHSKLevel);
        this._logAtStep("_filterSentences", this.characterMetadata.hskCharacterToLevelMap, filteredRandomizedChineseCharsByHskLevel);
    
        let next = filteredRandomizedChineseCharsByHskLevel;
        let prev;
        let prevCount = 0;
        let nextCount = 0;
        do {
            prev = this._generateSentencesFromUnqualifiedChars(next);
            next = this._generateSentencesFromUnqualifiedChars(prev);
            prevCount = this._countOfSentencesByHSKLevel(prev);
            nextCount = this._countOfSentencesByHSKLevel(next);
            if (prevCount != nextCount) {
                this.generatedMoreThanOneSetFromUnqualifiedChars += nextCount - prevCount;
            }
        } while (prevCount != nextCount);
        const unqualifiedAddedChineseCharsByHskLevel = next;

        const randomizedChineseSentencesByHSKLevel = this._convertChineseCharsToChineseSentenceModels(unqualifiedAddedChineseCharsByHskLevel);
        
        /** - code to confirm actual unqualified characters vs. expected ones before grouped char generation
        const actualUnqualifiedCharacters = JSON.parse(JSON.stringify(this.characterMetadata.hskCharacterToLevelMap));
        Object.keys(randomizedChineseSentencesByHSKLevel).forEach((hskLevel) => {
            const sentenceModels = randomizedChineseSentencesByHSKLevel[hskLevel];
            sentenceModels.forEach((sentenceModel) => {
                sentenceModel.character.split("").forEach((chineseCharacter) => {
                    delete actualUnqualifiedCharacters[chineseCharacter];
                });
            });
        });
        if (Object.keys(actualUnqualifiedCharacters).length == Object.keys(this.unqualifiedCharacters).length) {
            Object.keys(this.unqualifiedCharacters).forEach((chineseCharacter) => {
                delete actualUnqualifiedCharacters[chineseCharacter];
            })
        }
        */
        
        const finalizedUnqualifiedChars = JSON.parse(JSON.stringify(this.unqualifiedCharacters));
        const unqualifiedCharacterGroupsAsChineseSentenceModels = this._groupUnqualifiedCharacters();
        this._logAtStep("_groupUnqualifiedCharacters", 
            this.characterMetadata.hskCharacterToLevelMap, 
            this._joinSentencesByHSKLevelPerHSKLevel(unqualifiedCharacterGroupsAsChineseSentenceModels, 
                unqualifiedAddedChineseCharsByHskLevel));
        const allSentenceModels = this._joinSentencesByHSKLevel(randomizedChineseSentencesByHSKLevel, unqualifiedCharacterGroupsAsChineseSentenceModels);
        const finalOutputSentenceModels = this._sortByFirstTimeSeenSentenceValues(allSentenceModels);
        let sentenceIdentifier = 1;
        finalOutputSentenceModels.forEach((sentenceModel) => {
            sentenceModel.id = sentenceIdentifier;
            sentenceIdentifier++;
        });
        const logs = this.logger.loggingData;
        console.log(JSON.stringify(logs, null, 4));
        this.finalValidation = this.logger.logFinalValidation(this.characterMetadata, finalOutputSentenceModels, finalizedUnqualifiedChars);
        return finalOutputSentenceModels;
    }

    _countOfSentencesByHSKLevel(charsByHSKLevel) {
        let count = 0;
        Object.keys(charsByHSKLevel).forEach((hskLevel) => {
            count += charsByHSKLevel[hskLevel].length;
        })
        return count;
    }

    _sortByFirstTimeSeenSentenceValues(sentenceModels) {
        const sortedByOriginalValue = this._sortByOriginalSentenceValues(sentenceModels);
        const sortedByFirstTimeSeenValue = this._applyAndSortByFirstTimeSeenValues(sortedByOriginalValue);
        return sortedByFirstTimeSeenValue;
    }

    _applyAndSortByFirstTimeSeenValues(sentenceModels) {
        const sentenceModelsToSort = sentenceModels;
        const firstTimeSeenCharMap = {};
        sentenceModelsToSort.forEach((sentenceModel) => {
            const firstTimeSeenChars = [];
            const alreadySeen = {};
            sentenceModel.character.split("").forEach((chineseCharacter) => {
                if (this.characterMetadata.isValidCharacter(chineseCharacter) 
                    && !firstTimeSeenCharMap[chineseCharacter]
                    && !alreadySeen[chineseCharacter])  {
                    firstTimeSeenCharMap[chineseCharacter] = true;
                    alreadySeen[chineseCharacter] = true;
                    firstTimeSeenChars.push(chineseCharacter);
                }
            });
            const firstTimeSeenValue = this.characterMetadata.roundValue(firstTimeSeenChars.reduce((accumulator, chineseChar) => {
                return accumulator + ( this.characterMetadata.characterValueInSentences[chineseChar] 
                    ? this.characterMetadata.characterValueInSentences[chineseChar] 
                    : 0); 
            }, 0));
            sentenceModel.setNumFirstTimeShownChars(firstTimeSeenChars.length);
            sentenceModel.setNumFirstTimeShownValue(firstTimeSeenValue);
            sentenceModel.compound_definition = firstTimeSeenChars.join(",");
            const suffix = Number.parseInt(sentenceModel.hsk_level) !== Number.parseInt(sentenceModel.hsk_level) ? ")" : "";
            sentenceModel.hsk_level = sentenceModel.hsk_level + " - " + firstTimeSeenValue + suffix;
        });
        sentenceModelsToSort.sort((sentence1, sentence2) => {
            // prioritize grouped collections
            if (sentence1.isGroupedCollection && !sentence2.isGroupedCollection) {
                return -1;
            } else if (!sentence1.isGroupedCollection && sentence2.isGroupedCollection) {
                return 1;
            } else {
                // prioritize HSK levels
                if (sentence1.underlyingHSKLevel > sentence2.underlyingHSKLevel) {
                    return -1;
                } else if (sentence1.underlyingHSKLevel < sentence2.underlyingHSKLevel) {
                    return 1;
                } else {
                    // prioritize num first time shown chars
                    if (sentence1.numFirstTimeShownValue > sentence2.numFirstTimeShownValue) {
                        return -1;
                    } else if (sentence1.numFirstTimeShownValue < sentence2.numFirstTimeShownValue) {
                        return 1;
                    } else {
                        return 0;
                    }
                }
            }
        })
        return sentenceModelsToSort;
    }


    _sortByOriginalSentenceValues(sentenceModels) {
        const sentenceModelsToSort = sentenceModels;
        sentenceModelsToSort.forEach((sentenceModel) => {
            const sentenceValue = this.characterMetadata.chineseWordToSentenceValue[sentenceModel.underlyingChar];
            if (sentenceValue) {
                sentenceModel.setOriginalSentenceValue(sentenceValue);
            }
        });
        sentenceModelsToSort.sort((sentence1, sentence2) => {
            // prioritize grouped collections
            if (sentence1.isGroupedCollection && !sentence2.isGroupedCollection) {
                return -1;
            } else if (!sentence1.isGroupedCollection && sentence2.isGroupedCollection) {
                return 1;
            } else {
                // prioritize HSK levels
                if (sentence1.underlyingHSKLevel > sentence2.underlyingHSKLevel) {
                    return -1;
                } else if (sentence1.underlyingHSKLevel < sentence2.underlyingHSKLevel) {
                    return 1;
                } else {
                    // prioritize num first time shown chars
                    if (sentence1.originalSentenceValue > sentence2.originalSentenceValue) {
                        return -1;
                    } else if (sentence1.originalSentenceValue < sentence2.originalSentenceValue) {
                        return 1;
                    } else {
                        return 0;
                    }
                }
            }
        });
        return sentenceModelsToSort;
    }

    _joinSentencesByHSKLevel(sentencesByHSKLevel1, sentencesByHSKLevel2) {
        let joinedSentences = [];
        Object.keys(sentencesByHSKLevel1).forEach((hskLevel) => {
            const sentences1 = sentencesByHSKLevel1[hskLevel];
            const sentences2 = sentencesByHSKLevel2[hskLevel];
            joinedSentences = joinedSentences.concat(sentences1);
            joinedSentences = joinedSentences.concat(sentences2);
        });
        return joinedSentences;
    }

    _joinSentencesByHSKLevelPerHSKLevel(sentencesByHSKLevel1, sentencesByHskLevel2) {
        let joinedSentences = {};
        Object.keys(sentencesByHSKLevel1).forEach((hskLevel) => {
            joinedSentences[hskLevel] = sentencesByHSKLevel1[hskLevel].concat(sentencesByHskLevel2[hskLevel]);
        });
        return joinedSentences;
    }

    _convertChineseCharsToChineseSentenceModels(chineseCharsForSentencesByHSKLevel) {
        const sentenceModelsByHSKLevel = {};
        Object.keys(chineseCharsForSentencesByHSKLevel).forEach((hskLevel) => {
            const chineseChars = chineseCharsForSentencesByHSKLevel[hskLevel];
            const chineseSentences = [];
            chineseChars.forEach((chineseCharacter) => {
                chineseSentences.push(new ChineseSentenceModel(chineseCharacter, 0, hskLevel, chineseCharacter.character, chineseCharacter.underlyingChar, chineseCharacter.hsk_level, false));
            });
            sentenceModelsByHSKLevel[hskLevel] = chineseSentences;
        });
        return sentenceModelsByHSKLevel;
    }

    _groupUnqualifiedCharacters() {
        const unqualifiedCharactersByHskLevel = {};
        Object.keys(this.unqualifiedCharacters).forEach((chineseCharacter) => {
            const hskLevel = this.characterMetadata.hskCharacterToLevelMap[chineseCharacter];
            if (!unqualifiedCharactersByHskLevel[hskLevel]) {
                unqualifiedCharactersByHskLevel[hskLevel] = [];
            }
            unqualifiedCharactersByHskLevel[hskLevel].push(chineseCharacter);
        })
        const size = 10;
        const groupedUnqualifiedCharactersByHSKLevel = {};
        Object.keys(unqualifiedCharactersByHskLevel).forEach((hskLevel) => {
            const arrayOfArrays = [];
            const currentUnqualifiedChars = unqualifiedCharactersByHskLevel[hskLevel];
            for (var i = 0; i < currentUnqualifiedChars.length; i+= size) {
                arrayOfArrays.push(currentUnqualifiedChars.slice(i, i + size));
            }
            arrayOfArrays.forEach((groupedChars) => {
                const groupedCharsAsChineseSentence = this._convertGroupedCharsToSentence(groupedChars, hskLevel);
                if (!groupedUnqualifiedCharactersByHSKLevel[hskLevel]) {
                    groupedUnqualifiedCharactersByHSKLevel[hskLevel] = [];
                }
                groupedUnqualifiedCharactersByHSKLevel[hskLevel].push(groupedCharsAsChineseSentence);
            });
            
        });
        return groupedUnqualifiedCharactersByHSKLevel;
    }

    _convertGroupedCharsToSentence(groupedChars, hskLevel) {
        let accumulatedChars = "";
        let accumulatedPinyin = "";
        let accumulatedCompound = "";
        let numCharsShown = 0;
        groupedChars.forEach((value) => {
            const baseChar = this.characterMetadata.singleCharMapToDefinition[value];
            accumulatedChars = accumulatedChars + (accumulatedChars.length > 0 ? "，" : "") + baseChar.character;
            accumulatedPinyin = accumulatedPinyin + (accumulatedPinyin.length > 0 ? "，" : "") +  baseChar.character + " " + baseChar.character_pinyin;
            accumulatedCompound = accumulatedCompound + (accumulatedCompound.length > 0 ? "，" : "") +  baseChar.character + " " + baseChar.eng;
            numCharsShown++;
        });
        // var numFirstTimeShownValue = accumulatedChars.split("，").reduce((accumulator, chineseChar) => {
        //     const chineseCharFromJson = singleCharMapToDefinition[chineseChar];
        //     return accumulator + ( chineseCharFromJson ? (1 / chineseCharFromJson.characterAppearancesInValidSentences * chineseCharFromJson.hsk_level) : 0); 
        // }, 0);
        const chineseWordModel = new ChineseWordModel({
            id: 0,
            character: accumulatedChars,
            character_pinyin: accumulatedPinyin,
            eng: "",
            hsk_level: hskLevel,
            part_of_speech : "groupedChars",
            compound: accumulatedCompound,
            compound_cantonese: "",
            compound_pinyin: ""
        });
        const chineseSentenceModel = new ChineseSentenceModel(
            chineseWordModel,
            0,
            hskLevel,
            "",
            "",
            hskLevel,
            true
        );
        chineseSentenceModel.character= accumulatedChars;
        chineseSentenceModel.character_pinyin= accumulatedPinyin;
        chineseSentenceModel.eng= "";
        chineseSentenceModel.compound= accumulatedCompound;
        chineseSentenceModel.compound_cantonese = "";
        chineseSentenceModel.compound_definition= accumulatedChars;
        chineseSentenceModel.compound_pinyin= "";
        chineseSentenceModel.hsk_level= hskLevel;
        chineseSentenceModel.id = 0;
        chineseSentenceModel.part_of_speech = "groupedChars";
        chineseSentenceModel.eng_def_for_sentence = accumulatedCompound;
        chineseSentenceModel.underlyingChar = "";
        chineseSentenceModel.underlyingHSKLevel = hskLevel;
        chineseSentenceModel.numFirstTimeShownChars = numCharsShown;
        chineseSentenceModel.isGroupedCollection= true;
        return chineseSentenceModel;
    }


    // Generate another set after the filtering with the unqualified chars to see if there are any sentences we could've generated
    // No need to filter again since we already know this is a set of filtered sentences
    _generateSentencesFromUnqualifiedChars(sentencesByHSKLevel) {
        const combinedSentencesByHskLevel = {};
        Object.keys(this.unqualifiedCharacters).forEach((unqualifiedCharacter) => {
            const hskLevel = this.characterMetadata.hskCharacterToLevelMap[unqualifiedCharacter];
            this.chineseCharacterCandidates[hskLevel][unqualifiedCharacter] = true;
        });

        const candidatesAtStep = JSON.parse(JSON.stringify(this.chineseCharacterCandidates));
        const candidatesAtStepByHskLevel = {};
        Object.keys(candidatesAtStep).forEach((hskLevel) => {
            Object.keys(candidatesAtStep[hskLevel]).forEach((chineseCharacter) => {
                candidatesAtStepByHskLevel[chineseCharacter] = hskLevel;
            });
        });
        const anotherRandomizedSet = this._generateRandomizedSentences();
        const anotherFilteredSet = this._filterSentencesByUnseenCharCount(anotherRandomizedSet);
        this.levelsToInclude.forEach((level) => {
            combinedSentencesByHskLevel[level] = sentencesByHSKLevel[level].concat(anotherFilteredSet[level]);
        });
        this._logAtStep("_generateSentencesFromUnqualifiedChars", candidatesAtStepByHskLevel, combinedSentencesByHskLevel);
        return combinedSentencesByHskLevel;
    }

    // Filter out sentences
    _filterSentences(sentencesByHSKLevel) {
        const sentencesFilteredByUnseenCharCount = this._filterSentencesByUnseenCharCount(sentencesByHSKLevel);
        return sentencesFilteredByUnseenCharCount;
    }

    _filterSentencesByUnseenCharCount(sentencesByHSKLevel) {
        const filteredSentencesByHskLevel = {};
        const hskLevels = Object.keys(sentencesByHSKLevel).sort().reverse();
        for (var i = 0; i < hskLevels.length; i++) {
            const hskLevel = hskLevels[i];
            const sentencesForHskLevel = sentencesByHSKLevel[hskLevel];
            const filteredSentencesForCurrentLevel = sentencesForHskLevel.filter((sentence) => {
                const charactersInSentence = sentence.compound.split("");
                var charsOneAboveThreshold = [];
                for (var charIndex = 0; charIndex < charactersInSentence.length; charIndex++) {
                    const character = charactersInSentence[charIndex];
                    if (this.characterMetadata.isValidCharacter(character)
                    && this.chineseCharacterSeenCount[character] == (this.seenCountThreshold + 1)) {
                        charsOneAboveThreshold.push(character);
                    }
                }
                const willKeepSentence = charsOneAboveThreshold.length >= this.numUnseenToKeep;
                if (!willKeepSentence) {
                    const alreadySeen = {};
                    for (var j = 0; j < charactersInSentence.length; j++) {
                        const character = charactersInSentence[j];
                        if (alreadySeen[character]) {
                            continue;
                        }
                        if (this.chineseCharacterSeenCount[character] != null) {
                            this.chineseCharacterSeenCount[character]--;
                            if (this.chineseCharacterSeenCount[character] == 0) {
                                this.unqualifiedCharacters[character] = 0;
                            }
                        }
                        alreadySeen[character] = true;
                    }
                }
                return willKeepSentence;
            });
            filteredSentencesByHskLevel[hskLevel] = filteredSentencesForCurrentLevel;
        }
        return filteredSentencesByHskLevel;
    }

    // Randomized Sentence Generation

    // Randomized Sentence Generation
    _generateRandomizedSentences() {
        const randomizedSentencesByHSKLevel = {};
        this.levelsToInclude.forEach((hskLevel) => {
            const generatedSentencesForLevel = [];
            while (Object.keys(this.chineseCharacterCandidates[hskLevel]).length > 0) {
                const currentCandidates = Object.keys(this.chineseCharacterCandidates[hskLevel]);
                const randomCandidateIndex = this._randomIndex(currentCandidates);
                const currentCandidate = currentCandidates[randomCandidateIndex];
                const validChineseWordModels = this.characterMetadata.characterToValidSentenceMap[currentCandidate];
                if (validChineseWordModels) {
                    const validChineseWordModelsKeys = Object.keys(validChineseWordModels);
                    let addedValidCandidate = false;
                    while (validChineseWordModelsKeys.length > 0) {
                        const randomValidChineseWordModelIndex = this._randomIndex(validChineseWordModelsKeys);
                        const randomValidChineseWordModel = validChineseWordModels[validChineseWordModelsKeys[randomValidChineseWordModelIndex]];
                        if (this._isQualifiedSentence(randomValidChineseWordModel)) {
                            randomValidChineseWordModel.setUnderlyingChar(randomValidChineseWordModel.character);
                            this._updateSeenCountAndRemoveCharsFromCandidatePool(randomValidChineseWordModel);
                            generatedSentencesForLevel.push(randomValidChineseWordModel);
                            addedValidCandidate = true;
                            break;
                        } else {
                            validChineseWordModelsKeys.splice(randomValidChineseWordModelIndex, 1);
                        }
                    }
                    if (!addedValidCandidate) {
                        this.unqualifiedCharacters[currentCandidate] = 0;
                    }
                }
                delete this.chineseCharacterCandidates[hskLevel][currentCandidate];
            }
            randomizedSentencesByHSKLevel[hskLevel] = generatedSentencesForLevel;
        });

        return randomizedSentencesByHSKLevel;
    }

    _isQualifiedSentence(chineseWordModel) {
        let hasAnUnseenChar = false;
        const chineseCharactersInSentence = chineseWordModel.compound.split("");
        for (let i = 0; i < chineseCharactersInSentence.length; i++) {
            const chineseCharacter = chineseCharactersInSentence[i];
            if (this.chineseCharacterSeenCount[chineseCharacter] <= this.seenCountThreshold
                || this.unqualifiedCharacters[chineseCharacter] <= this.seenCountThreshold) {
                if (hasAnUnseenChar) {
                    return true; // has at least two chars that match the seen count threshold
                } else {
                    hasAnUnseenChar = true;
                }
            }
        }
        return false; // has only one unseen char
    }

    _updateSeenCountAndRemoveCharsFromCandidatePool(chineseWordModel) {
        const alreadySeen = {};
        chineseWordModel.compound.split("").forEach((chineseCharacter) => {
            if (!alreadySeen[chineseCharacter] && this.characterMetadata.isValidCharacter(chineseCharacter)) {
                alreadySeen[chineseCharacter] = true;
                this.chineseCharacterSeenCount[chineseCharacter]++;

                const hskLevelForCharacter = this.characterMetadata.hskCharacterToLevelMap[chineseCharacter];
                if (this.chineseCharacterCandidates[hskLevelForCharacter]) {
                    delete this.chineseCharacterCandidates[hskLevelForCharacter][chineseCharacter];
                }
                if (this.unqualifiedCharacters[chineseCharacter] != null) {
                    this.unqualifiedCharacters[chineseCharacter]++;
                    if (this.unqualifiedCharacters[chineseCharacter] > this.seenCountThreshold) {
                        delete this.unqualifiedCharacters[chineseCharacter];
                    }
                }
            }
        });
    }

    // helpers
    _logAtStep(stepName, candidatesAtStep, sentencesByHSKLevel) {
        this.logger.logAtStep(
            this.characterMetadata,
            stepName, 
            candidatesAtStep, 
            sentencesByHSKLevel, 
            this.unqualifiedCharacters,
            this.chineseCharacterSeenCount,
            this.seenCountThreshold);
    }

    _randomIndex(values) {
        return Math.floor(Math.random() * values.length);
    }

    _shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
          let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
      
          // swap elements array[i] and array[j]
          // we use "destructuring assignment" syntax to achieve that
          // you'll find more details about that syntax in later chapters
          // same can be written as:
          // let t = array[i]; array[i] = array[j]; array[j] = t
          [array[i], array[j]] = [array[j], array[i]];
        }
    }

}

function mapJsonToChineseWordModel (jsonModels) {
    const chineseWordToModel = {};
    jsonModels.forEach((json) => {
        const chineseWord = new ChineseWordModel(json);
        chineseWordToModel[chineseWord.character] = chineseWord;
    })
    return chineseWordToModel;
};

class SentenceGeneratorConfig {

    constructor(chineseWordModelsByHskLevelMap, 
        targetLevel, 
        seenCountThreshold, 
        numUnseenToKeep
    ) {
        this.chineseWordModelsByHskLevelMap = chineseWordModelsByHskLevelMap;
        this.targetLevel = targetLevel;
        // Suppose seenCountThreshold = 0; that means a char must be seen at least 1 time to be considered qualified.
        this.seenCountThreshold = seenCountThreshold;
        // This means a sentence needs at least two unseen words to keep
        this.numUnseenToKeep = numUnseenToKeep;
    }
}

function generateSentencesForV2(setUpWindow) {
    const chineseWordModelsByHskLevelMap = {
        1 : mapJsonToChineseWordModel(hskLevel1),
        2 : mapJsonToChineseWordModel(hskLevel2),
        3 : mapJsonToChineseWordModel(hskLevel3),
        4 : mapJsonToChineseWordModel(hskLevel4)
    };
    const sentenceGenerator = new SentenceGenerator(
        new SentenceGeneratorConfig(
            chineseWordModelsByHskLevelMap,
            4, // targetLevel,
            0, // seenCountThreshold,
            2, // numUnseenToKeep
        )
    );
    const sentences = sentenceGenerator.generatedSentences;
    if (setUpWindow) {
        window.sentenceGenerator = sentenceGenerator;
    }
    return sentences;
}

function main() {
    const sentences = generateSentencesForV2(false);
    console.log(sentences.length);
}
main();

/**
 * 
 * What do we want our algorithm to do...
 * 
 * generateSentences ({
 *  1: [ ChineseWordModel, ChineseWordModel, ...],
 *  2: [ ChineseWordModel, ChineseWordModel, ...],
 * ...
 * }
 * 
 *  Output : [
 *  ChineseWordModel, ...
 * ]
 * 
 * What we want is an array of ChineseWordModels that:
 * 
 * (1) are constructed by randomly selecting a character from the pool of characters, 
 * (2) picking a valid sentence which has more than one unseen character from among its compounds,
 * (3) removing the characters which appear in that sentence from the pool of characters
 * 
 * ^ repeated until we have no more characters.
 * 
 * ^ repeated for all levels.
 * 
 * Globally required information
 * 1. set up allChineseCharacters = frozen array of every character in the pool mapped to their hsk level
 * 2. set up characterPool from { hsk_level : { character : TRUE } } 
 * 
 * generateSentences() {
 * 
 *      setupValidSentenceMap()
 *         - sets up a map where {
 *             hsk_level: {
 *                 char : {
 *                     compound 1 : ChineseWordModel,
 *                     compound 2 : ChineseWordModel, ...
 *                 }
 *             }
 *         } but compound 1 & compound 2 , etc. must be a valid sentence
 * 
 *      getNextSentence() {
 *          given 
 *          { hskN : [char, char, char, ...] }
 * 
 *          As I pull random chars, I want to keep track of 2 things:
 *              chars seen so far
 *              chars that won't be added -> add this to a separate map
 *              A sentence is only added if it has 2 or more unseen chars... a char is unseen if it's not in the unseen so far or is in the separate map
 *                  do we want to loop through all compounds until we've exhausted? maybe
 *          
 *              After I pull a random character, I check its (randomly & removing) compounds and itself
 *              until I find a compound whose sentence has at least 2 unseen chars. These can be from the original pool or the unqualified chars.
 * 
 *              When I find a matching sentence, I iterate it and remove these chars as candidates; also compute the sentence value of this sentence.
 * 
 *              At some point, I will have no more sentences in this level.
 * 
 *          At the end, I have all of my sentences with at least 2 unseen chars and all of the chars that weren't a part of any sentences.
 *              Why do I know the unqualified chars aren't a part of any sentences?
 *                  1. every sentence that was ever a candidate would have tried to use them if it was possible
 *              
 *          Here's the problem...
 * 
 *          Sentence A: charA, charB are unseen
 *          Sentence B: charC, charD are unseen
 *          Sentence C: contains charA, charB, charC and charD
 * 
 *              as I add a sentence with 2 unseen chars, I keep track of another thing:
 *                  countOfCharInSentences: 
 * 
 *          After I've generated all of my sentences, I go through the sentences (from start -> end)
 *              For each sentence
 *                  For each character, if there are at least two chars where countOfCharInSentences[char] == 1, we can keep this sentence
 *                  If this sentence only has one of those, remove it and decrement countOfCharsInSentences for each char
 *          
 *          Look through countofCharInSentences for keys where the count is now 0 and add these back to the unqualified chars
 * 
 *          For all remaining unqualified chars, we can group by 10
 * 
 *          Sort by:
 *              unqualified char grouping
 *                  hsk level
 *                    sentence value
 *          
 *          Now we apply the 1st time seen chars again
 *      }
 * }
 */