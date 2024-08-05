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
                underlyingChar : randomKey,
                underlyingHSKLevel : charMapForReverseCheck[randomKey],
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

}

class CharacterMetadata {
    constructor(chineseWordModelsByHskLevelMap) {
        const hskLevelToValidMap = {};
        const hskCharacterToLevelMap = {};
        Object.keys(chineseWordModelsByHskLevelMap).forEach((key) => {
            Object.keys(chineseWordModelsByHskLevelMap[key]).forEach((character) => {
                if (!hskLevelToValidMap[key]) {
                    hskLevelToValidMap[key] = {};
                }
                hskLevelToValidMap[key][character] = true;
                hskCharacterToLevelMap[character] = key;
            });
        });
        this.hskLevelToValidMap = hskLevelToValidMap;
        this.hskCharacterToLevelMap = hskCharacterToLevelMap;
    }

    isValidSentence(sentence, targetLevel) {
        return sentence.split("").every((character) => {
            const characterLevel = this.hskCharacterToLevelMap[character];
            if (characterLevel != null) {
                return characterLevel <= targetLevel;
            }
            return false;
        });
    }
}


class SentenceGenerator {

    constructor(chineseWordModelsByHskLevelMap) {
        this.characterMetadata = new CharacterMetadata(chineseWordModelsByHskLevelMap);
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

    const sentenceGenerator = new SentenceGenerator(chineseWordModelsByHskLevelMap);
    console.log(Object.keys(sentenceGenerator.characterMetadata.hskCharacterToLevelMap).length);
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