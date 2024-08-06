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
        Object.keys(chineseWordModelsByHskLevelMap).forEach((hskLevel) => {
            Object.keys(chineseWordModelsByHskLevelMap[hskLevel]).forEach((chineseWord) => {
                const chineseWordModel = chineseWordModelsByHskLevelMap[hskLevel][chineseWord];
                if (chineseWordModel.isCharacter()) {
                    if (!hskLevelToCharacterMap[hskLevel]) {
                        hskLevelToCharacterMap[hskLevel] = {};
                    }
                    hskLevelToCharacterMap[hskLevel][chineseWord] = true;
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
                        if (this.charsToIgnore.indexOf(character) < 0 && !alreadySeen[character]) {
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
            if (this.charsToIgnore.indexOf(character) > -1) {
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
                    if (!alreadySeen[character] && this.charsToIgnore.indexOf(character) < 0) {
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
}


class SentenceGenerator {

    constructor(chineseWordModelsByHskLevelMap, targetLevel) {
        this.characterMetadata = new CharacterMetadata(chineseWordModelsByHskLevelMap, targetLevel);
    }

    generateSentences() {

    }

    _setupValidSentenceMap() {

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
    
    const chineseWordModelsByHskLevelMap = {
        1 : mapJsonToChineseWordModel(hskLevel1),
        2 : mapJsonToChineseWordModel(hskLevel2)
    };

    const sentenceGenerator = new SentenceGenerator(chineseWordModelsByHskLevelMap, 4);
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
 *          pick a random
 *      }
 * }
 */