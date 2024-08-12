import { hskLevel1 } from "../modules/hsk1.mjs";
import { hskLevel2 } from "../modules/hsk2.mjs";


/**
 *             newLangData.push({
                character: sentenceToUse.compound,
                character_pinyin: sentenceToUse.compound_pinyin,
                eng: "",
                compound : sentenceToUse.compound_definition,
                compound_cantonese : "",
                compound_definition: "",
                compound_pinyin: "",
                hsk_level: "(" + (lowerLevelsToDelete.length + 1) + " - " + randomChar,
                id: this.sentenceIndexCounter,
                part_of_speech: "sentence",
                eng_def_for_sentence : sentenceToUse.eng,
                underlyingChar : randomhskLevel,
                underlyingHSKLevel : charMapForReverseCheck[randomhskLevel],
                isGroupedCollection: false,
            });
 */

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
        this.compound = json.compound;
        this.compound_pinyin = json.compound_pinyin;
    }

    isCharacter() {
        return this.character.length == 1;
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
            "、"
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
    }
    
    // Sentence validation

    logAtStep(stepName, characterMetadata, sentencesByHSKLevel, unqualifiedCharacters, chineseCharacterSeenCount, seenCountThreshold) {
        const allChineseCharacters = JSON.parse(JSON.stringify(characterMetadata.hskCharacterToLevelMap));

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
        Object.keys(unqualifiedCharacters).forEach((unqualifiedCharacter) => {
            delete allChineseCharacters[unqualifiedCharacter];
        });
        const stats = {
            step : stepName,
            numSentences : numSentences,
            numSentencesPerHskLevel: numSentencesPerHskLevel,
            numUnqualifiedChars : Object.keys(unqualifiedCharacters).length,
            numCharsBelowSeenCountThreshold : charsAtOrBelowSeenCountThreshold.length,
            unaccountedForChars : Object.keys(allChineseCharacters)
        }
        this.loggingData.push(stats);
    }
}

class SentenceGenerator {

    constructor(chineseWordModelsByHskLevelMap, targetLevel, seenCountThreshold) {

        this.logger = new SentenceGeneratorLogger();
        const chineseWordModelsByHSKLevelMapToUse = {};
        Object.keys(chineseWordModelsByHskLevelMap).forEach((hskLevel) => {
            if (hskLevel <= targetLevel) {
                chineseWordModelsByHSKLevelMapToUse[hskLevel] = chineseWordModelsByHskLevelMap[hskLevel];
            };
        });
        this.seenCountThreshold = seenCountThreshold;
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

        this.generateSentences();
    }

    generateSentences() {
        const randomizedSentencesByHSKLevel = this._generateRandomizedSentences();
        const filteredRandomizedSentencesByHskLevel = this._filterSentences(randomizedSentencesByHSKLevel);
        const logs = this.logger.loggingData;
        debugger;
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
                if (charsOneAboveThreshold.length < 1) {
                    charactersInSentence.forEach((character) => {
                        if (this.chineseCharacterSeenCount[character] != null) {
                            this.chineseCharacterSeenCount[character]--;
                        }
                    })
                }
                return charsOneAboveThreshold.length > 0;
            });
            filteredSentencesByHskLevel[hskLevel] = filteredSentencesForCurrentLevel;
        }
        this._logAtStep("_filterSentencesByUnseenCharCount", filteredSentencesByHskLevel);
        return filteredSentencesByHskLevel;
    }

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
                const validChineseWordModelsKeys = Object.keys(validChineseWordModels);
                let addedValidCandidate = false;
                while (validChineseWordModelsKeys.length > 0) {
                    const randomValidChineseWordModelIndex = this._randomIndex(validChineseWordModelsKeys);
                    const randomValidChineseWordModel = validChineseWordModels[validChineseWordModelsKeys[randomValidChineseWordModelIndex]];
                    if (this._isQualifiedSentence(randomValidChineseWordModel)) {
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
                delete this.chineseCharacterCandidates[hskLevel][currentCandidate];
            }
            randomizedSentencesByHSKLevel[hskLevel] = generatedSentencesForLevel;
        });
        
        this._logAtStep("_generateRandomizedSentences", randomizedSentencesByHSKLevel);
        return randomizedSentencesByHSKLevel;
    }

    _isQualifiedSentence(chineseWordModel) {
        let hasAnUnseenChar = false;
        const chineseCharactersInSentence = chineseWordModel.compound.split("");
        for (let i = 0; i < chineseCharactersInSentence.length; i++) {
            const chineseCharacter = chineseCharactersInSentence[i];
            if (this.chineseCharacterSeenCount[chineseCharacter] == this.seenCountThreshold
                || this.unqualifiedCharacters[chineseCharacter] == this.seenCountThreshold) {
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
    _logAtStep(stepName, sentencesByHSKLevel) {
        this.logger.logAtStep(stepName, 
            this.characterMetadata, 
            sentencesByHSKLevel, 
            this.unqualifiedCharacters,
            this.chineseCharacterSeenCount,
            this.seenCountThreshold);
    }

    _randomIndex(values) {
        return Math.floor(Math.random() * values.length);
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

function main() {
    const targetLevel = 2;
    const chineseWordModelsByHskLevelMap = {
        1 : mapJsonToChineseWordModel(hskLevel1),
        2 : mapJsonToChineseWordModel(hskLevel2)
    };

    const sentenceGenerator = new SentenceGenerator(chineseWordModelsByHskLevelMap, targetLevel, 0);
    console.log(Object.keys(sentenceGenerator.characterMetadata.characterToValidSentenceMap).length);
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