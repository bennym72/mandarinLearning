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

        this.generateValidSentences();
    }

    generateValidSentences() {
        const characterToValidSentenceMap = {};
        Object.keys(this.chineseWordModelsByHskLevelMap).forEach((hskLevel) => {
            Object.keys(this.chineseWordModelsByHskLevelMap[hskLevel]).forEach((chineseWord) => {
                const chineseWordModel = this.chineseWordModelsByHskLevelMap[hskLevel][chineseWord];
                if (this.isValidSentence(chineseWordModel.compound)) {
                    const characters = chineseWordModel.character.split("");
                    characters.forEach((character) => {
                        if (this.charsToIgnore.indexOf(character) < 0) {
                            if (!characterToValidSentenceMap[character]) {
                                characterToValidSentenceMap[character] = {};
                            }
                            characterToValidSentenceMap[character][chineseWord] = chineseWordModel;
                        }
                    });
                }
            });
        });
        this.characterToValidSentenceMap = characterToValidSentenceMap;
    }

    isValidSentence(sentence) {
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