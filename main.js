/**
 * Site params
 */

const params = new URLSearchParams(window.location.search);
const currentSessionId = params.get("sessionId");
const numRows = Number.parseInt(params.get("numRows")) || 0;
const isJukugoTime = params.get("jukugo") === "true";

const isSequential = params.get("mode") !== "random";
const isSentenceMode = params.get("mode") == "sentence";
const isSkipLoserMode = params.get("skip") == "true";
const showPinyin = params.get("showPinyin") == "true";
const isSingleCharMode = params.get("showSingle") == "true";
const isCompoundWordMode = params.get("showCompound") == "true";
const isShowLevelByLevel = params.get("showLevelByLevel") == "true";
const isPrioCompoundSentence = params.get("prioCompoundSentence") == "true";

const isGenerateModeForCompound = params.get("compoundGeneration") == "true";
const isGenerateMode = params.get("generate") == "true" || isGenerateModeForCompound;
const isClearCacheMode = params.get("isClearCache") == "true";

if (isClearCacheMode) {
    localStorage = {};
}

/*
{
    hsk_level : {
        part_of_speech : [
            {
                id: 1,
                character : "",
                character_pinyin : "",
                eng : "",
                compound : "",
                compound_pinyin : "",
                compound_cantonese : "",
                compound_definition : ""
            }
        ]
    }
}
*/
const _groupedData = {};
const _groupedDataBy10 = {};

/**
 * Idea behind the sentenced data:
 * 
 * key = {char or pinyin if char.length > 1}
 * 
 * {
 *      key : sentence
 * }
 * 
 * const randomElement = array[Math.floor(Math.random() * array.length)];
 * getRandomSentence(Object.keys(_sentencedData)_
 * 
 * When the sentence is displayed, iterate over the chars and the pinyin and delete the keys from _sentencedData. 
 */
var _sentencedData = {};
var _initialTableData = [];
// params
var _selectionTable;
var _inputTable;

var langDataToUse = {}; //newLangData;
var _highestChosenHSKLevel = 0; // defaults to 0
var _highestAvailableHSKLevel = 0;
var _sentenceDataInput = "1,2,3,4";

const _hskLevelToSingleCharMap = {};
const _hskLevelToSentencedDataMap = {};

const singleCharMapToDefinition = {};

const charMap = {};
const charCountInValidSentences = {};

const charsToIgnore = [
    "。",
    "，",
    "?",
    "!",
    "！",
    "？",
    " ",
    "、"
];
const anyCharByHSKLevel = {};
charsToIgnore.forEach((value) => {
    anyCharByHSKLevel[value] = 1;
});

var loserCounter;
if (isGenerateMode) {
    if (!localStorage.loserCounterCache) {
        localStorage.loserCounterCache = "{}";
    }
    loserCounter = JSON.parse(localStorage.loserCounterCache);
}

const hskLevelString = "hsk_level_";

var data = hskLevel1.concat(hskLevel2);
data = data.concat(hskLevel3);
data = data.concat(hskLevel4);

// pragma mark - setup

const charToCompoundMap = {};
const charWithCompoundCandidatesMap = {};

const isValidSentence = function(hskLevel, sentence, character) {
    for (var i = 0; i < sentence.length; i++) {
        const currentChar = sentence[i];
        // a sentence is invalid if it doesn't appear at all or its minimum appearance is greater than the current hsk level
        const currentCharHSKLevel = anyCharByHSKLevel[currentChar];
        if (!currentCharHSKLevel || currentCharHSKLevel > hskLevel) {
            return false;
        }
        if (sentence.indexOf(character) < 0) {
            return false;
        }
    }
    return true;
}

function setupHeaders(nodeId, headers) {
    const table = document.querySelector(nodeId);
    const headerRow = table.insertRow();
    headers.forEach((value, index) => {
        const headerCell = headerRow.insertCell();
        // const sortButton = document.createElement("button");
        // headerCell.appendChild(sortButton);
        // const buttonId = nodeId + "_" + index;
        // sortButton.setAttribute("id", buttonId);
        headerCell.innerText = value;
    });
}

const tableCellRequiringUpdateIds = [
    "_inputTable_isValid_",
    "_inputTable_hasCharacter_",
    "_inputTable_numCharsOnSameLevel_",
    "_inputTable_invalidCharCell_",
    "_infoTable_numberOfAppearances_",
    "_inputTable_textInput_",
    "_inputTable_numberOfAppearances_",
    "_inputTable_sentenceValue_",
    "_inputTable_probabilityPicked_",
    "_inputTable_updatePriority_",
];

function documentSafeApplyText(selector, text) {
    const node = document.querySelector("#" + selector);
    if (node) {
        node.innerText = text;
    }
}

function shouldContinueRegenerationWork(value) {
    if (isGenerateModeForCompound) {
        return value.character.length != 1;
        // return compoundWordsForGeneration[value.character];
    }
    return true
    && value.character.length == 1;
}

function regenerateData() {
    Object.keys(charCountInValidSentences).forEach((value) => {
        charCountInValidSentences[value] = 0;
    });
    countAppearances();
    data.forEach((value, index) => {
        if (shouldContinueRegenerationWork(value)) {
            const infoRowValue = generateSentenceInfo(value, index);
            documentSafeApplyText(tableCellRequiringUpdateIds[0] + infoRowValue.character, infoRowValue.isValid);
            documentSafeApplyText(tableCellRequiringUpdateIds[1] + infoRowValue.character, infoRowValue.hasCharacter);
            documentSafeApplyText(tableCellRequiringUpdateIds[2] + infoRowValue.character, infoRowValue.numCharsOnSameLevel);
            documentSafeApplyText(tableCellRequiringUpdateIds[3] + infoRowValue.character, infoRowValue.invalidChars);
            documentSafeApplyText(tableCellRequiringUpdateIds[4] + infoRowValue.character, infoRowValue.numberOfAppearances);
            documentSafeApplyText(tableCellRequiringUpdateIds[6] + infoRowValue.character, infoRowValue.numberOfAppearances);
            documentSafeApplyText(tableCellRequiringUpdateIds[7] + infoRowValue.character, infoRowValue.sentenceValue);
            documentSafeApplyText(tableCellRequiringUpdateIds[9] + infoRowValue.character, infoRowValue.updatePriority);
            console.log(value.identifier);
        }
    });
}

const GenerateTableTypes = {
    InputTable : "inputTable",
    LoserTable : "loserTable",
}

function addInfoRowToTable(info, tableType) {
    const inputTable = document.querySelector("#_inputTable");

    const shouldAddInputRow = shouldContinueRegenerationWork(info) && tableType == GenerateTableTypes.InputTable;

    const shouldAddCharInfoRow = shouldContinueRegenerationWork(info) && tableType == GenerateTableTypes.InputTable;

    const shouldAddLoserInfoRow = shouldContinueRegenerationWork(info) && tableType == GenerateTableTypes.LoserTable;
    
    if (shouldAddInputRow) {
        const inputRow = inputTable.insertRow();
        const idCell = inputRow.insertCell();
        idCell.classList.add("shortColumn");
        idCell.innerText = info.identifier;
        const charCell = inputRow.insertCell();
        charCell.classList.add("shortColumn");
        charCell.innerText = info.character;
        const engCell = inputRow.insertCell();
        engCell.classList.add("shortColumn");
        engCell.innerText = info.english;
        const hskCell = inputRow.insertCell();
        hskCell.classList.add("shortColumn");
        hskCell.innerText = info.hskLevel;

        const isValidCell = inputRow.insertCell();
        isValidCell.setAttribute("id", tableCellRequiringUpdateIds[0] + info.character);
        isValidCell.classList.add("shortColumn");
        isValidCell.innerText = info.isValid;

        const hasCharacterCell = inputRow.insertCell();
        hasCharacterCell.setAttribute("id", tableCellRequiringUpdateIds[1] + info.character);
        hasCharacterCell.classList.add("shortColumn");
        hasCharacterCell.innerText = info.hasCharacter;

        const sentenceCell = inputRow.insertCell();
        sentenceCell.classList.add("shortColumn");
        const textInput = document.createElement("input");
        textInput.setAttribute("id", tableCellRequiringUpdateIds[5] + info.character);
        textInput.setAttribute("type", "text");
        textInput.classList.add("shortColumn");
        sentenceCell.appendChild(textInput);
        textInput.value = info.sentence;

        const numCharsOnSameLevelCell = inputRow.insertCell();
        numCharsOnSameLevelCell.classList.add("shortColumn");
        numCharsOnSameLevelCell.setAttribute("id", tableCellRequiringUpdateIds[2] + info.character);
        numCharsOnSameLevelCell.innerText = info.numCharsOnSameLevel;
        
        const numAppearanceCell = inputRow.insertCell();
        numAppearanceCell.classList.add("shortColumn");
        numAppearanceCell.setAttribute("id", tableCellRequiringUpdateIds[6] + info.character);
        numAppearanceCell.innerText = info.numberOfAppearances;
        
        const invalidCharCell = inputRow.insertCell();
        invalidCharCell.setAttribute("id", tableCellRequiringUpdateIds[3] + info.character);
        invalidCharCell.classList.add("shortColumn");
        invalidCharCell.innerText = info.invalidChars;

        const sentenceValueCell = inputRow.insertCell();
        sentenceValueCell.setAttribute("id", tableCellRequiringUpdateIds[7] + info.character);
        sentenceValueCell.classList.add("shortColumn");
        sentenceValueCell.innerText = info.sentenceValue;

        const pPickedCell = inputRow.insertCell();
        pPickedCell.setAttribute("id", tableCellRequiringUpdateIds[8] + info.character);
        pPickedCell.classList.add("shortColumn");
        pPickedCell.innerText = info.pPicked;

        const updatePriority = inputRow.insertCell();
        updatePriority.setAttribute("id", tableCellRequiringUpdateIds[9] + info.character);
        updatePriority.classList.add("shortColumn");
        updatePriority.innerText = info.updatePriority;
    }
    if (shouldAddCharInfoRow) {
        const infoTable = document.querySelector("#_currentInfoTable")
        const inputRow2 = infoTable.insertRow();
        const idCell2 = inputRow2.insertCell();
        idCell2.classList.add("shortColumn");
        idCell2.innerText = info.identifier;
        const charCell2 = inputRow2.insertCell();
        charCell2.classList.add("shortColumn");
        charCell2.innerText = info.character;
        const engCell2 = inputRow2.insertCell();
        engCell2.classList.add("shortColumn");
        engCell2.innerText = info.english;
        const hskCell2 = inputRow2.insertCell();
        hskCell2.classList.add("shortColumn");
        hskCell2.innerText = info.hskLevel;

        const numAppearanceCell = inputRow2.insertCell();
        numAppearanceCell.classList.add("shortColumn");
        numAppearanceCell.setAttribute("id", tableCellRequiringUpdateIds[4] + info.character);
        numAppearanceCell.innerText = info.numberOfAppearances;
        
        const charValueCell = inputRow2.insertCell();
        charValueCell.classList.add("shortColumn");
        charValueCell.innerText = info.charValueInSentences;
    }

    if (shouldAddLoserInfoRow) {
        const loserTable = document.querySelector("#_loserTable")
        const inputRow3 = loserTable.insertRow();
        const idCell3 = inputRow3.insertCell();
        idCell3.classList.add("shortColumn");
        idCell3.innerText = info.identifier;
        const charCell3 = inputRow3.insertCell();
        charCell3.classList.add("shortColumn");
        charCell3.innerText = info.character;
        const engCell3 = inputRow3.insertCell();
        engCell3.classList.add("shortColumn");
        engCell3.innerText = info.english;
        const hskCell3 = inputRow3.insertCell();
        hskCell3.classList.add("shortColumn");
        hskCell3.innerText = info.hskLevel;

        const positionCell = inputRow3.insertCell();
        positionCell.classList.add("shortColumn");
        positionCell.innerText = info.position;

        const countCell = inputRow3.insertCell();
        countCell.classList.add("shortColumn");
        countCell.innerText = info.loserCount;
    }
    
}

function setupSelectionTable() {
    _selectionTable = document.querySelector("#_selectionTable");
    var index = 0;
    _initialTableData.forEach((selection) => {
        const newRow = _selectionTable.insertRow();
        const rowId = "selectionRow" + index;
        const selectionCell = newRow.insertCell();
        const checkbox = document.createElement("input");
        checkbox.setAttribute("type", "checkbox");
        selectionCell.appendChild(checkbox);
        selectionCell.classList.add("checkbox");
        selectionCell.setAttribute("id", rowId);
        selectionCell.classList.add(hskLevelString + selection.hsk_level);

        const hskLevelCell = newRow.insertCell();
        hskLevelCell.innerText = selection.hsk_level;
        hskLevelCell.classList.add("hsk");
        hskLevelCell.setAttribute("id", rowId + "_hsk");

        const countCell = newRow.insertCell();
        countCell.innerText = selection.count;
        countCell.classList.add("selection_count");
        countCell.setAttribute("id", rowId + "_count");

        const partOfSpeechCell = newRow.insertCell();
        partOfSpeechCell.innerText = selection.part_of_speech;
        partOfSpeechCell.classList.add("part_of_speech");
        partOfSpeechCell.setAttribute("id", rowId + "_pos");

        index++;
    });
}

// pragma mark - init functions

function shouldIncludeCharacter(value) {
    if (isSingleCharMode) {
        return value.character.length == 1;
    } else if (isCompoundWordMode) {
        return value.character.length > 1;
    }
    return true;
}

const tones = [
    '$',
    '\u0304', // tone 1
    '\u0301', // tone 2
    '\u030c', // tone 3
    '\u0300', // tone 4
];
// Returns the tone, and the index of the letter with the tone
function findTone(w) {
  const n = w.normalize('NFD');
  for (let i = 0; i < n.length; i++) {
    if (tones.includes(n[i])){
      return tones.indexOf(n[i]); // /*[*/n[i]/*, i - 1]*/;
    }
  }
}

function initializeData() {

    data.forEach((value) => {
        for (var j = 0; j < value.character.length; j++) {
            const charAt = value.character[j];
            charCountInValidSentences[charAt] = 0;
            /**
             * Use the minimum. Suppose char1 shows up at 1 and 2, char2 only shows up at 2. If we want to select only level 1 chars, char1 = 1 would let us know to include char1... but if char1 = 2, we couldn't distinguish char1 & char2
             */
            if (anyCharByHSKLevel[charAt]) {
                anyCharByHSKLevel[charAt] = Math.min(anyCharByHSKLevel[charAt], value.hsk_level);
            } else {
                anyCharByHSKLevel[charAt] = value.hsk_level;
            }
            _highestAvailableHSKLevel = Math.max(_highestAvailableHSKLevel, value.hsk_level);
        }
        if (value.character.length == 1) {
            singleCharMapToDefinition[value.character] = value;
        }
    });

    if (isGenerateMode || isGenerateModeForCompound) {
        generateSentenceValues();
    }

    data.forEach((value) => {
        if (!_groupedData[value.hsk_level]) {
            _groupedData[value.hsk_level] = {};
        }
        if (!_groupedData[value.hsk_level][value.part_of_speech]) {
            _groupedData[value.hsk_level][value.part_of_speech] = [];
        }
        
        if (shouldIncludeCharacter(value)) {
            _groupedData[value.hsk_level][value.part_of_speech].push(value);
        }

        if (isSingleCharMode) {
            value.tone = findTone(value.character_pinyin);
        }
    });

    function partOfSpeechString(partOfSpeech, counter) {
        if (counter < 10) {
            return partOfSpeech + "-0" + counter;
        }
        return partOfSpeech + "-" + counter;
    }

    Object.keys(_groupedData).forEach((hskLevel) => {
        _groupedDataBy10[hskLevel] = [];
        Object.keys(_groupedData[hskLevel]).forEach((partOfSpeech) => {
            var currentArray = [];
            var counter = 1;
            _groupedData[hskLevel][partOfSpeech].forEach((word) => {    
                if (currentArray.length < 10) {
                    currentArray.push(word);
                } else {
                    _groupedDataBy10[hskLevel][partOfSpeechString(partOfSpeech, counter)] = currentArray;
                    _initialTableData.push({
                        hsk_level : hskLevel,
                        part_of_speech : partOfSpeechString(partOfSpeech, counter),
                    });
                    counter++;
                    currentArray = [word];
                    
                }
            });
            _groupedDataBy10[hskLevel][partOfSpeechString(partOfSpeech, counter)] = currentArray;
            _initialTableData.push({
                hsk_level : hskLevel,
                part_of_speech : partOfSpeechString(partOfSpeech, counter),
            });
        });
    });
    
    _initialTableData = _initialTableData.sort((a, b) => {
        if (a.hsk_level - b.hsk_level != 0) {
            return a.hsk_level - b.hsk_level;
        }
        if (a.part_of_speech < b.part_of_speech) {
            return - 1;
        } else if (a.part_of_speech == b.part_of_speech) {
            return 0;
        } else {
            return 1;
        }
    });
    _initialTableData.forEach((tableRowInfo) => {
        tableRowInfo.count = _groupedDataBy10[tableRowInfo.hsk_level][tableRowInfo.part_of_speech].length;
    });

    if (showPinyin) {
        document.getElementById("_currentEng").classList.add("inProgressShow1");
    }

    // set up the char to compound map
    data.forEach((value) => {
        const character = value.character;
        const hskLevel = value.hsk_level;
        if (hskLevel == 3) { // temp condition for hsk 3 sentence generation
            if (character.length == 1) {
                if (!charToCompoundMap[character]) {
                    charToCompoundMap[character] = {}
                }
            } else {
                character.split("").forEach((component) => {

                    if (!charToCompoundMap[component]) {
                        charToCompoundMap[component] = {}
                    }

                    if (!charToCompoundMap[component][hskLevel]) {
                        charToCompoundMap[component][hskLevel] = {}
                    }
                    charToCompoundMap[component][hskLevel][character] = isValidSentence(3, value.compound, character);
                });
            }
        }
    });

    var candidates = {};
    Object.keys(charToCompoundMap).forEach((singleChar) => {
        Object.keys(charToCompoundMap[singleChar]).forEach((hskLevel) => {
            var hasValidCompound = false;
            const currentCandidates = [];
            Object.keys(charToCompoundMap[singleChar][hskLevel]).forEach((compound) => {
                if (!candidates[compound]) {
                    currentCandidates.push(compound);
                }
                hasValidCompound = hasValidCompound || charToCompoundMap[singleChar][hskLevel][compound];
            });
            if (!hasValidCompound) {
                charWithCompoundCandidatesMap[singleChar] = charToCompoundMap[singleChar];
                if (currentCandidates.length) {
                    candidates[currentCandidates[Math.floor(Math.random() * currentCandidates.length)]] = true;
                }
            }
        });
    });
}

const mergeSentenceData = function (values) {
    const hskLevelsToUse = values.split(",");
    if (hskLevelsToUse.length < 1) {
        window.alert("Input a valid selection of HSK levels!");
        return;
    }
    _sentencedData = _hskLevelToSentencedDataMap[hskLevelsToUse[0]];
    for (var i = 1; i < hskLevelsToUse.length; i++) {
        const sentencesToMerge = _hskLevelToSentencedDataMap[hskLevelsToUse[i]];
        if (sentencesToMerge) {
            mergeTwoSentenceData(_sentencedData, sentencesToMerge);
        }
    }
    console.log(Object.keys(_sentencedData).length);
}

const mergeTwoSentenceData = function (data1, data2) {
    Object.keys(data2).forEach((key) => {
        if (data1[key]) {
            Object.keys(data2[key]).forEach((word) => {
                data1[key][word] = data2[key][word];
            })
        } else {
            data1[key] = data2[key];
        }
    });
}

const convertMandarinToKanji = function(mandarin, map) {
    const kanji = {
        index : mandarin.id,
        stars : mandarin.hsk_level,
        kanji : mandarin.character,
        onyomi : mandarin.eng,
        kunyomiList : [
            {
                hiragana : mandarin.compound_cantonese,
                compound: " " + mandarin.compound + " ",
                definition : mandarin.compound_definition,
                compound_sound: mandarin.compound_pinyin,
                stars : mandarin.character,
            }
        ],
        eng : mandarin.character_pinyin,
        tone : mandarin.tone,
        eng_def_for_sentence : mandarin.eng_def_for_sentence,
        numFirstTimeShownChars : (Number.isInteger(mandarin.numFirstTimeShownChars) ? mandarin.numFirstTimeShownChars : 1)
    };
    map[kanji.index] = kanji;
};

const betaColor = "#BF2F12";
const obsoleteColor = "#F7C20F";
const phases = [
    "inProgressStart",
    "inProgressShow1",
    "inProgressShow1-table",
    "inProgressShow2",
    "inProgressShow2-table",
    "inProgressDialog1",
    "inProgressDialog2",
    "inProgressEnd"
];

class KanjiState {
    constructor () {
        this._setInitialValues()
    }

    _setInitialValues() {
        this.allCurrentKanji = [];
        this.wasViewed = [];
        this.toView = [];
        this.currentKanji = null;
        this.currentCorrect = 0;
        this.currentCounter = 0;
        this.sentenceCounter = 0;
        this.sentenceTotal = 0;
        this.dialogCurrentType = "";
        this.dialogCurrentIndex = 0;
        this.currentWrong = [];
        this.currentKanjis = [];
        this.sentences = {}
        this.overview = "";
    }

    clear() {
        this._setInitialValues()
        this.storeValues();
        
    }

    getValuesFromWindowName() {
        if (!localStorage) {
            localStorage = {};
        }
        if (!localStorage.persistedValue) {
            localStorage.persistedValue = "";
        }
        if (!localStorage.persistedSentences) {
            localStorage.persistedSentences = "";
        }

        if (this.getPersistedValues().length) {
            const state = JSON.parse(this.getPersistedValues());
            this.allCurrentKanji = state.allCurrentKanji;
            this.wasViewed = state.wasViewed;
            this.toView = state.toView;
            this.currentKanji = state.currentKanji;
            this.currentCorrect = state.currentCorrect;
            this.currentCounter = state.currentCounter;
            this.sentenceCounter = state.sentenceCounter;
            this.sentenceTotal = state.sentenceTotal;
            this.dialogCurrentType = state.dialogCurrentType;
            this.dialogCurrentIndex = state.currentIndex;
            this.currentWrong = state.currentWrong;
            this.currentKanjis = state.currentKanjis;
            this.overview = state.overview;
            if (this.currentKanji) {
                this.toView.unshift(Number.parseInt(this.currentKanji.index));
                this.currentKanji = null;
            }
            if (this.currentKanjis) {
                this.toView.unshift(...this.currentKanjis.map((value) => { return Number.parseInt(value.index)}));
                this.currentKanjis = null;
            }
        } else {
            this._setInitialValues();
        }

        if (localStorage.persistedSentences.length) {
            const sentences = JSON.parse(localStorage.persistedSentences);
            this.sentences = sentences;
        }
    }

    getPersistedValues() {
        if (currentSessionId) {
            return localStorage[currentSessionId];
        } else {
            return localStorage.persistedValue;
        }
    }

    storeSentences(sentences) {
        // we don't want to store sentences every time we press next because it's a big object so we don't want to parse it so often
        localStorage.persistedSentences = JSON.stringify(sentences);
    }
    
    clearSentences() {
        delete localStorage.persistedSentences;
    }

    storeValues() {
        if (currentSessionId) {
            localStorage[currentSessionId] = JSON.stringify(
                {
                    allCurrentKanji: this.allCurrentKanji,
                    wasViewed: this.wasViewed,
                    toView : this.toView,
                    currentKanji : this.currentKanji,
                    currentCorrect : this.currentCorrect,
                    currentCounter: this.currentCounter,
                    sentenceCounter : this.sentenceCounter,
                    sentenceTotal : this.sentenceTotal,
                    dialogCurrentType: this.dialogCurrentType,
                    dialogCurrentIndex: this.dialogCurrentIndex,
                    currentWrong: this.currentWrong,
                    currentKanjis : this.currentKanjis,
                    overview : this.overview,
                }
            );
        } else {
            localStorage.persistedValue = JSON.stringify(
                {
                    allCurrentKanji: this.allCurrentKanji,
                    wasViewed: this.wasViewed,
                    toView : this.toView,
                    currentKanji : this.currentKanji,
                    currentCorrect : this.currentCorrect,
                    currentCounter: this.currentCounter,
                    sentenceCounter : this.sentenceCounter,
                    sentenceTotal : this.sentenceTotal,
                    dialogCurrentType: this.dialogCurrentType,
                    dialogCurrentIndex: this.dialogCurrentIndex,
                    currentWrong: this.currentWrong,
                    currentKanjis : this.currentKanjis,
                    overview : this.overview,
                }
            )
        }
    }

    onReview() {
        const currentWrong = JSON.parse(JSON.stringify(this.currentWrong));
        this.clear();
        this.toView = currentWrong;
    }
}

function convertKanjiToJukugo() {
    const allJukugo = {};
    const jukugoToView = [];
    let counter = 0;
    sortedNewLangDataKeys.forEach((identifier) => {
        const currentKanji = newLangData[identifier];
        if (currentKanji.jukugoList) {
            currentKanji.jukugoList.forEach((currentJukugo) => {
                let definitionToUse;
                const definitionParts = currentJukugo.components.split("=");
                if (definitionParts.length > 1) {
                    const lastPart = definitionParts.pop();
                    definitionToUse = lastPart + " =<br />" + definitionParts[0];
                } else {
                    definitionToUse = currentJukugo.definition.split("-").pop();
                }
                const jukugo = {
                    eng: definitionToUse,
                    index: counter,
                    isBeta: false,
                    isObsolete: false,
                    isOnlyRadical: false,
                    jukugoList: [],
                    kanji: currentJukugo.kanji,
                    kunyomiList: [{
                        definition: currentJukugo.definition,
                        hiragana: currentJukugo.hiragana,
                        stars: currentJukugo.stars
                    }],
                    onyomi: "",
                    stars: currentJukugo.stars
                };
                allJukugo[counter] = jukugo;
                jukugoToView.push(jukugo.index);
                counter++;
            });
        }
    });
    langDataToUse = allJukugo;
}

if (isJukugoTime) {
    this.convertKanjiToJukugo();   
}

function htmlToArray(arr) {
    return Array.prototype.slice.call(arr);
}

function generateIdFromStartAndEnd(start, end) {
    return start + " - " + end;
}

function parseSelectionFromStartAndEndId(value) {
    return value.split(" - ").map((current) => {
        return Number.parseInt(current);
    });
}

function shuffleBackHalf(arr) {
    const backHalf = [];
    const half = Math.floor(arr.length / 2);
    for (var i = half; i > 0; i--) {
        const top = arr.pop();
        if (top) {
            backHalf.push(top);
        }
    }
    shuffle(backHalf);
    arr.push(...backHalf);
}

function shuffle(array) {
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

function init() {
    console.log("it's starting!");

    if (isGenerateMode) {
        document.querySelector("#_generateButton").classList.remove("hidden");
        document.querySelector("#_inputTable").classList.remove("hidden");
        document.querySelector("#_currentInfoTable").classList.remove("hidden");
        document.querySelector("#_loserTable").classList.remove("hidden");
        document.querySelector("#_resumeButton").classList.add("hidden");
        document.querySelector("#_resumeButton").classList.remove("inProgressStart");
    } else if (isSentenceMode) {
        document.querySelector("#_currentKanji").classList.remove("kanji");
        document.querySelector("#_currentKanji").classList.add("kanjiSentence");
        document.querySelector("#_currentCompound").classList.remove("currentCompound");
        document.querySelector("#_currentCompound").classList.add("currentSentenceDefinition");
        document.querySelector("#_currentEng").classList.remove("pinyin");
        document.querySelector("#_currentEng").classList.add("pinyinSentence");
        document.querySelector("#_currentHir").classList.remove("cantonese");
        document.querySelector("#_currentHir").classList.add("cantoneseSentence");
        document.querySelector("#_currentCompoundDefinition").classList.remove("compoundDefinition");
        document.querySelector("#_currentCompoundDefinition").classList.add("compoundDefinitionSentence");
        document.querySelector("#_sentenceCounter").classList.remove("hidden");
    } else if (isSingleCharMode) {
        document.querySelector("#_currentCompound").classList.add("inProgressShow1");
    }
    
    initializeData();

    if (isGenerateMode) {
        setupHeaders("#_inputTable", [
            "id",
            "character",
            "eng",
            "hsk",
            "isValid",
            "hasCharacter",
            "sentence",
            "same",
            "appear",
            "exc",
            "SV",
            "pPicked",
            "upd_prio",
        ]);
        setupHeaders("#_currentInfoTable", [
            "id",
            "char",
            "eng",
            "hsk",
            "numA",
            "CV",
        ]);
    } else {
        setupSelectionTable();
        if (numRows > 0) {
            const table = document.querySelector("#_kanjiTable");
            for (var i = 0; i < numRows; i++) {
                const currentRow = document.createElement("tr");
                const tdKanji = document.createElement("td");
                tdKanji.classList.add("tdKanji");
                const tdHiragana = document.createElement("td");
                tdHiragana.classList.add("tdHiragana");
                const tdEnglish = document.createElement("td");
                tdEnglish.classList.add("inProgressShow2-table");
                tdEnglish.classList.add("tableDefinition");
                currentRow.appendChild(tdKanji);
                currentRow.appendChild(tdHiragana);
                currentRow.appendChild(tdEnglish);
                table.appendChild(currentRow);
            }
        }
    }
    window.gameboard = numRows === 0 ? new BaseBoard() : new TableBoard();
    gameboard.enableStartPhase();
    if (isGenerateMode) {
        document.querySelector("#_selectionTable").classList.add("hidden");
        document.querySelector("#_hskLevelInput").classList.add("hidden");
        document.querySelector("#_sentenceToChar").classList.add("hidden");
        document.querySelector(".start").classList.add("hidden");
        Array.prototype.slice.call(document.querySelectorAll(".accumulationCounter")).forEach((node) => {
            node.classList.add("hidden");
        });
        window.gameboard.onStart();
    }
}

function onKanjiPressed() {
    const kanji = document.querySelector("#_currentKanji");
    copyToClipboard(kanji.innerText);
};

function copyToClipboard(text) {
    // const elem = document.createElement('textarea');
    // elem.value = text;
    // document.body.appendChild(elem);
    // elem.select();
    // document.execCommand('copy');
    // document.body.removeChild(elem);
 }

/*
    Currently, we randomly select sentences with an even distribution. We take a random character from our pool of candidates, pick a valid sentence, and remove all other characters in that sentence from the pool of characters.
    We want this because we prefer random so that we don't end up memorizing sentences.

    A character X's likelihood to be picked at the time of selection is 1/# of chars.
    A character X's likelihood of being eliminated as a result of another character Y being selected is # of appearances in sentences / # of chars.
    
    ^^^ this means characters like "我","是"，“不”, etc. are unlikely to ever be picked because they're likely to be eliminated. That means there's no point in generating valuable sentences for these characters.

    Each character should have a probabilityPicked score. Probability picked... imagine a character shows up in 4 total sentences (including its own appearance). That means in a single run, we expect it to get picked
    1/4 times.

    For characters with a high likelihood of being picked, we want to generate valuable sentences.

    How do we value a sentence in a measurable way?

    1. has to be valid (ie. carries only same HSK level + below)
    2. sum of probability to be picked / # of chars
    3. We also want to factor in the HSK level (maybe just a multiplier)... ie. a char in HSK 1 can show up in 2/3/4 but a char in HSK 4 can't show up in 1, so we really want to think of an HSK 4 char in a valid sentence as 4x more valuable than an HSK 1.

    So what we want to do is find all of the "low value" sentences for high probabilityPicked scores and convert them to higher valued sentences.
*/
var numTotalValidSentences = 0;
const chineseWordToSentenceValue = {};
function generateSentenceValues() {
    const validValuesOnly = data.reduce((accumulator, value) => {
        if (isValidSentence(value.hsk_level, value.compound, value.character)) {
            accumulator.push(value);
        }
        return accumulator;
    }, []);
    
    validValuesOnly.forEach((chineseWordFromJson) => {
        numTotalValidSentences++;
        const alreadySeen = {};
        chineseWordFromJson.compound.split("").forEach((chineseChar) => {
            if (singleCharMapToDefinition[chineseChar] && !alreadySeen[chineseChar]) {
                if (!singleCharMapToDefinition[chineseChar].characterAppearancesInValidSentences) {
                    singleCharMapToDefinition[chineseChar].characterAppearancesInValidSentences = 1;
                } else {
                    singleCharMapToDefinition[chineseChar].characterAppearancesInValidSentences += 1;
                }
                alreadySeen[chineseChar] = true;
            }
        });
    });

    Object.keys(singleCharMapToDefinition).forEach((chineseChar) => {
        const chineseWordFromJson = singleCharMapToDefinition[chineseChar];
        chineseWordFromJson.characterValueInSentences = 1 / chineseWordFromJson.characterAppearancesInValidSentences * chineseWordFromJson.hsk_level;
        //(1 - (chineseWordFromJson.characterAppearancesInValidSentences / numTotalValidSentences)) * chineseWordFromJson.hsk_level;
    });

    validValuesOnly.forEach((chineseWordFromJson) => {
        var sentenceValue = 0;
        chineseWordFromJson.compound.split("").forEach((chineseChar) => {
            const singleCharFromJson = singleCharMapToDefinition[chineseChar];
            if (singleCharFromJson) {
                sentenceValue += singleCharFromJson.characterValueInSentences;
            }
        });
        const value = sentenceValue / chineseWordFromJson.compound.length; 
        chineseWordToSentenceValue[chineseWordFromJson.character] = Math.round((value + Number.EPSILON) * 1000) / 1000;
    });
}

function countAppearances() {
    data.forEach((value) => {
                
        /**
         * Idea behind sentence mode is that for every HSK level, we will iterate through every word in that HSK level and map that character to a sentence.
         * {
         *      1 : {
         *              char : {
         *                          word: sentence,
         *                          word: sentence
         *                      }
         *          }
         *  }
         */
        if (value.character.length == 1) {

            if (!_hskLevelToSingleCharMap[value.hsk_level] ) {
                _hskLevelToSingleCharMap[value.hsk_level] = {};
            }
            _hskLevelToSingleCharMap[value.hsk_level][value.character] = value;                

            // only capturing single chars
            charMap[value.character] = value;
        }
        /**
         * For the purposes of generating the "valid sentence" console output to figure out which sentences are valid at HSK 1 (for example), we need to input 1 into the input box.
         * Without the input box, the "isValidSentence" will check a word's sentence for if it's valid compared to the highest available HSK level... ie. if an HSK level 1 word includes an HSK level 3 in its sentence
         * and this site supports up to HSK 3, then that would be considered valid.
         * 
         * This is done so that if there are some HSK 1 sentences which aren't valid at HSK 1, we can include them if we're testing HSK 3.
         */
        const targetNode = document.querySelector("#" + tableCellRequiringUpdateIds[5] + value.character);
        const sentenceForCharacter = isGenerateMode && targetNode
        ? targetNode.value
        : value.compound;
        const hskLevelToCheck = _highestChosenHSKLevel > 0 ? _highestAvailableHSKLevel : _highestAvailableHSKLevel;
        if (value.character != sentenceForCharacter && isValidSentence(hskLevelToCheck, sentenceForCharacter, value.character)) {
            for (var i = 0; i < value.character.length; i++) {
                const charAt = value.character[i];
                if (!_sentencedData[charAt]) {
                    _sentencedData[charAt] = {};
                }

                if (!_hskLevelToSentencedDataMap[value.hsk_level] ) {
                    _hskLevelToSentencedDataMap[value.hsk_level] = {};
                }
                if (!_hskLevelToSentencedDataMap[value.hsk_level][charAt]) {
                    _hskLevelToSentencedDataMap[value.hsk_level][charAt] = {};
                }

                _hskLevelToSentencedDataMap[value.hsk_level][charAt][value.character] = {
                    compound : sentenceForCharacter,
                    compound_pinyin : value.compound_pinyin,
                    compound_definition : value.compound_definition,
                    eng : value.eng
                };

                _sentencedData[charAt][value.character] = {
                    compound : sentenceForCharacter,
                    compound_pinyin : value.compound_pinyin,
                    compound_definition : value.compound_definition,
                    eng : value.eng
                };
                delete charMap[charAt];
            }

            for (var j = 0; j < sentenceForCharacter.length; j++) {
                charCountInValidSentences[sentenceForCharacter[j]] = charCountInValidSentences[sentenceForCharacter[j]] + 1;
            }
        }
    
    });
}

function generateSentenceInfo(value, index, sentenceCheck) {
    const identifier = index + 1;
    const character = value.character;
    const targetNode = document.querySelector("#" + tableCellRequiringUpdateIds[5] + character);
    const sentenceForCharacter = isGenerateMode && targetNode
    ? targetNode.value
    : value.compound;
    var excludedChars = "";
    const hskLevelForValue = value.hsk_level;
    var hasCharacter = false;
    var numCharsOnSameLevel = 0;
    for (var i = 0; i < sentenceForCharacter.length; i++) {
        const charAt = sentenceForCharacter[i];
        const currentCharHSKLevel = anyCharByHSKLevel[charAt];
        if (!currentCharHSKLevel || currentCharHSKLevel > hskLevelForValue) {
            excludedChars = excludedChars + charAt;
        }
        hasCharacter = hasCharacter || character == charAt;
        if (hskLevelForValue === currentCharHSKLevel && charsToIgnore.indexOf(charAt) < 0) {
            numCharsOnSameLevel++;
        }
    }
    const compoundCount = value.character.length;
    const isValid = value.compound.length > value.character.length && excludedChars.length == 0;
    const numberOfAppearances = singleCharMapToDefinition[character] ? singleCharMapToDefinition[character].characterAppearancesInValidSentences : 0;
    if (sentenceCheck) {
    const separator = "%";
    sentenceCheck.push(identifier + 
        separator + character + 
        separator + value.eng + 
        separator + hskLevelForValue + 
        separator + isValid + 
        separator + sentenceForCharacter + 
        separator + value.compound_pinyin + 
        separator + value.compound_definition + 
        separator + (excludedChars.length? excludedChars : ".") + 
        separator + compoundCount + 
        separator + numberOfAppearances +
        separator + numCharsOnSameLevel +
        separator + hasCharacter);
    }

    /*
    We don't actually want to include the value of the included word itself because that inflates its score artificially.

    We also don't want to count duplicates because a sentence of "hahahahaha" only teaches me "ha" once.
    */
    var accumulatedValue = 0;
    const alreadySeen = {};
    character.split("").forEach((currentChar) => {
        alreadySeen[currentChar] = true;
    });
    sentenceForCharacter.split("").forEach((chineseChar) => {
        const singleCharFromJson = singleCharMapToDefinition[chineseChar];
        if (singleCharFromJson && singleCharFromJson.character) {

            if (singleCharFromJson && !alreadySeen[singleCharFromJson.character] && character != singleCharFromJson.character) {
                accumulatedValue += singleCharFromJson.characterValueInSentences;
            }
            alreadySeen[singleCharFromJson.character] = true;
        }
    });
    
    const sentenceValue = Math.round((accumulatedValue /*/ sentenceForCharacter.length*/ + Number.EPSILON) * 1000) / 1000; 

    var appearancePercentage = 0;
    character.split("").forEach((chineseChar) => {
        if (singleCharMapToDefinition[chineseChar]) {
            const newAppearancePercentage = 1 / singleCharMapToDefinition[chineseChar].characterAppearancesInValidSentences;
            appearancePercentage = Math.max(appearancePercentage, newAppearancePercentage);
        }
    }); 
    const pPicked = Math.round((appearancePercentage  + Number.EPSILON) * 1000) / 1000; 

    const updatePriority = Math.round(((pPicked/sentenceValue) + Number.EPSILON) * 1000) / 1000; 

    const charValueInSentences = singleCharMapToDefinition[character] ? Math.round((singleCharMapToDefinition[character].characterValueInSentences+ Number.EPSILON) * 1000) / 1000 : 0;

    const infoRowValue = {
        identifier : identifier,
        character : character,
        english : value.eng,
        hskLevel : hskLevelForValue,
        isValid : isValid,
        sentence : sentenceForCharacter,
        invalidChars : (excludedChars.length? excludedChars : ""),
        hasCharacter : hasCharacter,
        numberOfAppearances : numberOfAppearances,
        numCharsOnSameLevel : numCharsOnSameLevel,
        sentenceValue : sentenceValue,
        pPicked : pPicked,
        updatePriority : updatePriority,
        charValueInSentences : charValueInSentences,
    };
    return infoRowValue;
}

class BaseBoard {
    constructor() {
        this.siteState = new KanjiState();
        this.sentenceIndexCounter = 0;
    }

    onInputStartChange(value) {
        const start = Number.parseInt(value);
        const end = document.getElementById("_inputEnd");
        end.value = start + 2999;
    }

    validateCurrentData(newLangData, charMapForReverseCheck) {
                        // code for checking that all chars are actually shown
        const charMapDeepCopy = JSON.parse(JSON.stringify(charMapForReverseCheck));
        newLangData.forEach((sentence) => {
            sentence.character.split("").forEach((char) => {
                delete charMapDeepCopy[char];
            })
        });
        const arr1 = Object.keys(charMapDeepCopy);
        const arr2 = Object.keys(charMap);
        let symDifference = arr1.filter(x => !arr2.includes(x))
                        .concat(arr2.filter(x => !arr1.includes(x)));
        debugger;
        return symDifference;
    }
    
    onStart(){
        var newLangData = [];
        const charMapForReverseCheck = {};

        if (isSentenceMode) {

            data.forEach((value) => {
                if (value.character.length == 1) {
                    charMapForReverseCheck[value.character] = value.hsk_level;
                }
            });
        
            countAppearances();

            console.log("Num chars excluded: " + Object.keys(charMap).length);

            // code for checking excluded characters
            const sentenceCheck = [];
            data.forEach((value, index) => {
                const infoRowValue = generateSentenceInfo(value, index, sentenceCheck);
                addInfoRowToTable(infoRowValue, GenerateTableTypes.InputTable);
            }); 
            const sentenceCheckAsString = sentenceCheck.join("\n");
            console.log(sentenceCheckAsString);
            console.log(charCountInValidSentences);

            mergeSentenceData(_sentenceDataInput);
            _sentenceDataInput.split(",").forEach((level) => {
                this.siteState.sentenceTotal += Object.keys(_hskLevelToSingleCharMap[level]).length;
            });

            const hsk1SentencesKeys = Object.keys(_hskLevelToSingleCharMap[1]);
            const hsk1Sentences = this._sentencesForKeys(_sentencedData, hsk1SentencesKeys);
            const hsk2SentencesKeys = Object.keys(_hskLevelToSingleCharMap[2]);
            const hsk2Sentences = this._sentencesForKeys(_sentencedData, hsk2SentencesKeys);
            const hsk3SentencesKeys = Object.keys(_hskLevelToSingleCharMap[3]);
            const hsk3Sentences = this._sentencesForKeys(_sentencedData, hsk3SentencesKeys);
            const hsk4SentencesKeys = Object.keys(_hskLevelToSingleCharMap[4]);
            const hsk4Sentences = this._sentencesForKeys(_sentencedData, hsk4SentencesKeys);
            this._convertSentencedDataToNewLangData(newLangData, charMapForReverseCheck, hsk4Sentences, [hsk3Sentences, hsk2Sentences, hsk1Sentences]);
            this._convertSentencedDataToNewLangData(newLangData, charMapForReverseCheck, hsk3Sentences, [hsk2Sentences, hsk1Sentences]);
            this._convertSentencedDataToNewLangData(newLangData, charMapForReverseCheck, hsk2Sentences, [hsk1Sentences]);
            this._convertSentencedDataToNewLangData(newLangData, charMapForReverseCheck, hsk1Sentences, []);

            // this.validateCurrentData(newLangData, charMapForReverseCheck);

            const sentencesToDelete = this._reverseCheckSentences(charMapForReverseCheck, newLangData);
            sentencesToDelete.forEach((index) => {
                newLangData[index] = null;
            });
            newLangData = newLangData.filter(value => value);
            const numSentences = newLangData.length;
    
            // this.validateCurrentData(newLangData, charMapForReverseCheck);

            this._applyFirstSeenChar(charMapForReverseCheck, newLangData);

            var charsWithoutSentenceCount = 0;
            const charMapKeys = Object.keys(charMap);
            window.shuffle(charMapKeys);
            charMapKeys.forEach((charMapKey) => {
                const value = charMap[charMapKey];
                value.underlyingChar = value.character;
                value.underlyingHSKLevel = value.hsk_level;
                value.numFirstTimeShownChars = 1;
                if (_highestChosenHSKLevel == 0 || value.hsk_level <= _highestChosenHSKLevel) {
                    charsWithoutSentenceCount += 1;
                    newLangData.push(value);
                }
            });

            // this.validateCurrentData(newLangData, charMapForReverseCheck);
            if (isSkipLoserMode) {

                newLangData = this._mergeGoodSentencesWithGroupedChars(newLangData);

                newLangData.sort((sentence1, sentence2) => {
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
                            if (sentence1.numFirstTimeShownChars > sentence2.numFirstTimeShownChars) {
                                return -1;
                            } else if (sentence1.numFirstTimeShownChars < sentence2.numFirstTimeShownChars) {
                                return 1;
                            } else {
                                return 0;
                            }
                        }
                    }
                });

                this.validateCurrentData(newLangData, charMapForReverseCheck);

                const lowerUnusedKeys = {};
                if (_sentenceDataInput.length == 1) {
                    const selectedLevel = Number.parseInt(_sentenceDataInput);
                    for (var i = 1; i < selectedLevel; i++) {
                        Object.keys(_hskLevelToSingleCharMap[i]).forEach((lowerLevelKey) => {
                            lowerUnusedKeys[lowerLevelKey] = true;
                        });                    
                    }
                }
                newLangData.forEach((finalizedSentence) => {
                    finalizedSentence.character.split("").forEach((finalizedChar) => {
                        delete lowerUnusedKeys[finalizedChar];
                    });
                });
                const additionalSentences = this._collapseIntoBucketsOf10(Object.keys(lowerUnusedKeys), []);
                newLangData.push(...additionalSentences);
                for (var i = 0; i < newLangData.length; i++) {
                    const finalizedSentence = newLangData[i];
                    if (!finalizedSentence.isGroupedCollection) {
                        break;
                    }
                    charsWithoutSentenceCount += finalizedSentence.numFirstTimeShownChars;
                }
            } else {
                newLangData.sort((sentence1, sentence2) => {
                    if (sentence1.underlyingHSKLevel == sentence2.underlyingHSKLevel) {
                        if (sentence1.numFirstTimeShownChars > sentence2.numFirstTimeShownChars) {
                            return -1;
                        } else if (sentence1.numFirstTimeShownChars < sentence2.numFirstTimeShownChars) {
                            return 1;
                        } else {
                            return 0;
                        }
                    } else if (sentence1.underlyingHSKLevel > sentence2.underlyingHSKLevel) {
                        return -1;
                    } else {
                        return 1;
                    }
                });
            }

            var idCounter = 1;
            newLangData.forEach((value) => {
                value.id = idCounter;
                idCounter++;
            });

            window.individualCharMap = charMap;
            // console.log(Object.keys(charMap).join("%"));

            const sentenceToChar = "# sen: " + numSentences + "; # chr: " + charsWithoutSentenceCount + "; # del: " + sentencesToDelete.length;
            this.siteState.overview = sentenceToChar;
        } else {
            const checkedBoxes = Array.prototype.slice.call(document.querySelectorAll('input[type=checkbox]:checked'));
            checkedBoxes.forEach(checkedBox => {
                const selectedHskLevel = checkedBox.parentElement.parentElement.querySelector(".hsk").innerText;
                const selectedPartOfSpeech = checkedBox.parentElement.parentElement.querySelector(".part_of_speech").innerText;
                newLangData = newLangData.concat(_groupedDataBy10[selectedHskLevel][selectedPartOfSpeech]);
            });
        }
        const loserChars = [];
        const loserCharsInTable = {};
        var position = 0;
        newLangData.forEach((mandarinChar) => {
            convertMandarinToKanji(mandarinChar, langDataToUse);
            if (isGenerateMode && mandarinChar.numFirstTimeShownChars < 2) {
                var loserCount = 1;
                if (loserCounter[mandarinChar.underlyingChar]) {
                    loserCounter[mandarinChar.underlyingChar] += 1;
                    loserCount = loserCounter[mandarinChar.underlyingChar];
                } else {
                    loserCounter[mandarinChar.underlyingChar] = 1;
                };
                const loserData = {
                    identifier : mandarinChar.id,
                    character : mandarinChar.underlyingChar.length > 0 ? mandarinChar.underlyingChar : mandarinChar.character,
                    english : mandarinChar.underlyingChar.length > 0 ? singleCharMapToDefinition[mandarinChar.underlyingChar].eng : mandarinChar.eng,
                    hskLevel : mandarinChar.underlyingHSKLevel,
                    isValid : true,
                    sentence : mandarinChar.compound,
                    invalidChars : "",
                    hasCharacter : true,
                    numberOfAppearances : 0,
                    numCharsOnSameLevel : 0,
                    position : position,
                    loserCount : loserCount,
                };
                loserChars.push(loserData);
                loserCharsInTable[mandarinChar.underlyingChar] = true;
                position++;
            }
        });

        if (isGenerateMode) {
            if (!localStorage.loserCounterCacheCount) {
                localStorage.loserCounterCacheCount = 1;
            } else {
                localStorage.loserCounterCacheCount = Number.parseInt(localStorage.loserCounterCacheCount) + 1;
            }
            localStorage.loserCounterCache = JSON.stringify(loserCounter);
            setupHeaders("#_loserTable", [
                "id",
                "char",
                "eng",
                "hsk",
                "position",
                "count (" + localStorage.loserCounterCacheCount + ")"
            ]);
            const revLoserChars = loserChars.reverse();
            let positionCounter = 1000;
            Object.keys(loserCounter).forEach((loser) => {
                if (!loserCharsInTable[loser]) {
                    const loserCount = loserCounter[loser];
                    const singleDefinition = singleCharMapToDefinition[loser];
                    const loserFromCache = {
                        identifier : positionCounter,
                        character : loser,
                        english : singleDefinition.eng,
                        hskLevel : singleDefinition.hsk_level,
                        isValid : true,
                        sentence : "",
                        invalidChars : "",
                        hasCharacter : true,
                        numberOfAppearances : 0,
                        numCharsOnSameLevel : 0,
                        position : positionCounter,
                        loserCount : loserCount,
                    };
                    loserChars.push(loserFromCache);
                    positionCounter++;
                }
            })

            revLoserChars.forEach((value) => {
                addInfoRowToTable(value, GenerateTableTypes.LoserTable);
            });
        } else {

            this.siteState.storeSentences(langDataToUse);
            this.enablePhase1(true);
        }
    }

    /**
     * This function looks through each sentence to determine if it's a good one or if the new unseen chars of this sentence should be removed and collapsed into
     * buckets of 10. Currently, the criteria is that a good sentence shows at least 2 new chars.
     * @param {reference pointer to new lang data} newLangData 
     * @returns 
     */
    _mergeGoodSentencesWithGroupedChars(newLangData) {
        const groupedSetsByLevel = {};
        const hskLevelsForSkipping = {};
        _sentenceDataInput.split(",").forEach((hskLevelInput) => {
            groupedSetsByLevel[hskLevelInput] = [[]];
            hskLevelsForSkipping[hskLevelInput] = [];
        });
        const allCharsThatShowUpInSentences = {};
        for (var i = 0; i < newLangData.length; i++) {
            const sentence = newLangData[i];
            const currentHSKLevel = sentence.underlyingHSKLevel;
            if (sentence.numFirstTimeShownChars > 1) {
                if (groupedSetsByLevel[currentHSKLevel]) {
                    groupedSetsByLevel[currentHSKLevel][0].push(sentence);
                    sentence.character.split("").forEach((charInSentence) => {
                        allCharsThatShowUpInSentences[charInSentence] = true;
                    });
                }
            } else {
                // when we have a sentence that only has 1 newly seen char, this newly seen char might end up being shown in a future sentence
                // so we don't want to group this as an unseen character later.
                var willEncounterCharacterLater = false;
                for (var j = i + 1; j < newLangData.length; j++) {
                    var innerSentence = newLangData[j];
                    if (innerSentence.character.indexOf(sentence.underlyingChar) > -1) {
                        willEncounterCharacterLater = true;
                        innerSentence.compound_definition += "," + sentence.underlyingChar;
                        innerSentence.numFirstTimeShownChars += 1;
                        break;
                    }
                }
                if (!willEncounterCharacterLater) {
                    if (hskLevelsForSkipping[sentence.underlyingHSKLevel]) {
                        hskLevelsForSkipping[sentence.underlyingHSKLevel].push(sentence.underlyingChar);
                    }
                }
            }
        };
        Object.keys(hskLevelsForSkipping).forEach((hskLevel) => {
            const groupedChars = this._collapseIntoBucketsOf10(hskLevelsForSkipping[hskLevel], allCharsThatShowUpInSentences);
            groupedSetsByLevel[hskLevel].push(groupedChars);
        });
        if (isShowLevelByLevel) {
            var output = [];
            (Object.keys(groupedSetsByLevel).reverse()).forEach((key) => {
                groupedSetsByLevel[key].forEach((contents) => {
                    output = output.concat(contents);
                });
            });
            
            return output;
        } else {
            var groupedSentences = [];
            var groupedChars = [];
            (Object.keys(groupedSetsByLevel).reverse()).forEach((key) => {
            
                const sentences = groupedSetsByLevel[key][0];
                if (sentences) {
                    groupedSentences = groupedSentences.concat(sentences);
                }
                const characters = groupedSetsByLevel[key][1];
                if (characters) {
                    groupedChars = groupedChars.concat(characters);
                }
            });
            return groupedChars.concat(groupedSentences);
        }
    }

    _collapseIntoBucketsOf10(singleChars, allCharsThatShowUpInSentences) {
        var size = 10; 
        var arrayOfArrays = [];
        const singleCharsToUse = singleChars.filter((value) => {
            return !allCharsThatShowUpInSentences[value];
        });
        for (var i=0; i<singleCharsToUse.length; i+=size) {
             arrayOfArrays.push(singleCharsToUse.slice(i,i+size));
        }
        console.log(arrayOfArrays);
        const result = arrayOfArrays.map((array) => {
            let accumulatedChars = "";
            let accumulatedPinyin = "";
            let accumulatedCompound = "";
            let hskLevel = 0;
            let numCharsShown = 0;
            array.forEach((value) => {
                const baseChar = singleCharMapToDefinition[value];
                accumulatedChars = accumulatedChars + (accumulatedChars.length > 0 ? "，" : "") + baseChar.character;
                accumulatedPinyin = accumulatedPinyin + (accumulatedPinyin.length > 0 ? "，" : "") +  baseChar.character + " " + baseChar.character_pinyin;
                accumulatedCompound = accumulatedCompound + (accumulatedCompound.length > 0 ? "，" : "") +  baseChar.character + " " + baseChar.eng;
                hskLevel = baseChar.hsk_level;
                numCharsShown++;
            });
            return {
                character: accumulatedChars,
                character_pinyin: accumulatedPinyin,
                eng: "",
                compound: accumulatedCompound,
                compound_cantonese : "",
                compound_definition: accumulatedChars,
                compound_pinyin: "",
                hsk_level: hskLevel,
                id : 0,
                part_of_speech : "groupedChars",
                eng_def_for_sentence : accumulatedCompound,
                underlyingChar : "",
                underlyingHSKLevel : hskLevel,
                numFirstTimeShownChars : numCharsShown,
                isGroupedCollection: true,
            };
        });
        return result;
    }

    _sentencesForKeys(sentencedData, keys) {
        const result = {};
        keys.forEach(key => {
            if (sentencedData[key]) {
                result[key] = sentencedData[key];
                delete sentencedData[key];
            }
        });
        return result;
    }

    _convertSentencedDataToNewLangData(newLangData, charMapForReverseCheck, sentencedData, lowerLevelsToDelete) {
        while (Object.keys(sentencedData).length > 0) {
            const startAmount = Object.keys(sentencedData).length;
            const keys = Object.keys(sentencedData);
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            const charToUseMap = sentencedData[randomKey];
            let charToUseKeys = Object.keys(charToUseMap).filter((value) => { 
                return value.length > 1;
            });
            charToUseKeys = isPrioCompoundSentence && charToUseKeys.length > 0 ? charToUseKeys : Object.keys(charToUseMap);
            const randomChar = charToUseKeys[Math.floor(Math.random() * charToUseKeys.length)];
            const sentenceToUse = charToUseMap[randomChar];
            delete sentencedData[randomKey];
            const deletedChars = [];
            const firstTimeShownChars = [];
            for (let i = 0; i < sentenceToUse.compound.length; i++) {
                const charThatWillShow = sentenceToUse.compound[i];
                delete charMap[charThatWillShow];
                if (sentencedData[charThatWillShow]) {
                    firstTimeShownChars.push(charThatWillShow);
                    deletedChars.push(charThatWillShow);
                } else if (charThatWillShow == randomKey && firstTimeShownChars.indexOf(charThatWillShow) < 0) {
                    firstTimeShownChars.push(charThatWillShow);
                }
                delete sentencedData[charThatWillShow];
                lowerLevelsToDelete.forEach(lowerLevelSentences => {
                    if (lowerLevelSentences[charThatWillShow]) {
                        firstTimeShownChars.push(charThatWillShow);
                    }
                    delete lowerLevelSentences[charThatWillShow];
                });
            }
            newLangData.push({
                character: sentenceToUse.compound,
                character_pinyin: sentenceToUse.compound_pinyin,
                eng: "",
                compound : sentenceToUse.compound_definition,
                compound_cantonese : "",
                compound_definition: "",
                compound_pinyin: "",
                hsk_level: "(" + (lowerLevelsToDelete.length + 1) + " - " + randomChar + ")",
                id: this.sentenceIndexCounter,
                part_of_speech: "sentence",
                eng_def_for_sentence : sentenceToUse.eng,
                underlyingChar : randomKey,
                underlyingHSKLevel : charMapForReverseCheck[randomKey],
                isGroupedCollection: false,
            });
            const endAmount = Object.keys(sentencedData).length;
            console.log(randomChar + "; " + deletedChars.join("") + " ;" + " Start amount: " + startAmount + "; End amount: " + endAmount);
            this.sentenceIndexCounter++;
        }
    }

    /**
     * Sentences are generated from a random order. A sentence at the Nth position may show x new characters going from 0->END. However, sentences at >Nth position
     * may end up showing those x characters as well. When a sentence at the Nth position ends up showing 0 new characters by factoring the new characters shown in the >Nth positions,
     * we can just remove that sentence at the Nth position as it does not show any characters that wouldn't be seen later.
     * @param {map of every char used to generate the sentences} charMapForReverseCheck 
     * @param {reference pointer to new lang data} newLangData 
     * @returns array of sentences to delete by iD
     */
    _reverseCheckSentences(charMapForReverseCheck, newLangData) {
        const charMapDeepCopy = JSON.parse(JSON.stringify(charMapForReverseCheck));
        const sentencesToDelete = [];
        for (var i = newLangData.length - 1; i >= 0; i--) {
            const currentSentence = newLangData[i].character;
            var hasNewChar = false;
            currentSentence.split("").forEach((value) => {
                if (charMapDeepCopy[value]) {
                    hasNewChar = true;
                    delete charMapDeepCopy[value];
                }
            });
            if (!hasNewChar) {
                sentencesToDelete.push(i);
            }
        }
        return sentencesToDelete;
    }

    _applyFirstSeenChar(charMapForReverseCheck, newLangData) {
        const charMapDeepCopy = JSON.parse(JSON.stringify(charMapForReverseCheck));
        newLangData.forEach((sentence) => {
            const firstTimeShownChars = [];
            const currentSentence = sentence.character;
            let highestFirstSeenHSKChar = sentence.underlyingHSKLevel;
            currentSentence.split("").forEach((charAt) => {
                if (charMapDeepCopy[charAt]) {
                    firstTimeShownChars.push(charAt);
                    if (charMapDeepCopy[charAt] > highestFirstSeenHSKChar) {
                        highestFirstSeenHSKChar = charMapDeepCopy[charAt];
                    }
                    delete charMapDeepCopy[charAt];
                }
            });
            if (highestFirstSeenHSKChar > sentence.underlyingHSKLevel) {
                console.log(sentence);
            }
            sentence.underlyingHSKLevel = highestFirstSeenHSKChar;
            sentence.compound_definition = firstTimeShownChars.join(",");
            sentence.numFirstTimeShownChars = firstTimeShownChars.length;
        });
    }
    
    onResume() {
        this.siteState.getValuesFromWindowName();
        if (!this.siteState.toView.length) {
            return;
        }
        langDataToUse = this.siteState.sentences;
        this.enablePhase1(false);
    }

    onClear() {

    }
    
    onShow() {
        this.enablePhase2();  
    }
    
    back() {
        if (this.siteState.wasViewed.length) {
            this.siteState.currentCounter--;
            this.siteState.currentCorrect--;
            this.siteState.sentenceCounter -= langDataToUse[this.siteState.wasViewed[this.siteState.wasViewed.length - 1]].numFirstTimeShownChars;
            this.siteState.toView.unshift(this.siteState.currentKanji.index);
            this.siteState.toView.unshift(this.siteState.wasViewed.pop());
            this.enablePhase1();
        } else {
            this.end();
        }
    }
    
    correct() {
        this.siteState.currentCounter++;
        this.siteState.currentCorrect++;
        this.siteState.sentenceCounter += this.siteState.currentKanji.numFirstTimeShownChars;
        this.siteState.wasViewed.push(this.siteState.currentKanji.index);
        if (this.siteState.toView.length) {
            this.enablePhase1();
        } else {
            this.enableEndPhase();
        }
    }
    
    incorrect() {
        this.siteState.currentCounter++;
        this.siteState.toView.push(this.siteState.currentKanji.index);
        this.siteState.currentWrong.push(this.siteState.currentKanji.index);
        if (!isSequential) {
            window.shuffleBackHalf(this.siteState.toView);
        }
        this.enablePhase1();
    }

    searchChar() {
        const popupWindow = document.querySelector("#_popupWindow");
        popupWindow.classList.remove("hidden");
        const charToSearch = document.querySelector("#_charSearchInput").value;
        const charValue = singleCharMapToDefinition[charToSearch];
        document.querySelector("#_popupWindowCharHSKLevel").innerText = charValue.hsk_level;
        document.querySelector("#_popupWindowCharPartOfSpeech").innerText = charValue.part_of_speech;
        document.querySelector("#_popupWindowCharCharacter").innerText = charValue.character;
        document.querySelector("#_popupWindowCharPinyin").innerText = charValue.character_pinyin;
        document.querySelector("#_popupWindowCharEnglish").innerText = charValue.eng;

    }

    closeSearchChar() {
        const popupWindow = document.querySelector("#_popupWindow");
        document.querySelector("#_charSearchInput").value = "";
        popupWindow.classList.add("hidden");
        document.querySelector("#_popupWindowCharHSKLevel").innerText = "?";
        document.querySelector("#_popupWindowCharPartOfSpeech").innerText = "?";
        document.querySelector("#_popupWindowCharCharacter").innerText = "?";
        document.querySelector("#_popupWindowCharPinyin").innerText = "?";
        document.querySelector("#_popupWindowCharEnglish").innerText = "?";
    }

    dialogShow() {
        this.hideAllExcept("inProgressDialog2");
    }
    
    kunyomi() {
        this.populateDialog("kunyomi", this.siteState.dialogCurrentIndex);
    }
    
    jukugo() {
        this.populateDialog("jukugo", this.siteState.dialogCurrentIndex);
    }
    
    review() {
        this.siteState.onReview();
        this.enablePhase1();
    }
    
    end() {
        this.enableStartPhase();
        this.siteState.clear();
    }
    
    dialogHide(){
        this.siteState.dialogCurrentType = "";
        this.siteState.dialogCurrentIndex = 0;
        this.enablePhase2();
    }
    
    dialogPrevious() {
        this.populateDialog(this.siteState.dialogCurrentType, this.siteState.dialogCurrentIndex - 1);
    }
    
    dialogNext() {
        this.populateDialog(this.siteState.dialogCurrentType, this.siteState.dialogCurrentIndex + 1);
    }
    
    hideAllExcept(phaseToShow) {
        phases.forEach((value) => {
            const elements = document.getElementsByClassName(value);
            for (var i = 0; i < elements.length; i++) {
                if (phaseToShow !== value) {
                    elements[i].classList.add("hidden");    
                }
            }
        });
        phases.forEach((value) => {
            const elements = document.getElementsByClassName(value);
            for (var i = 0; i < elements.length; i++) {
                if (phaseToShow === value) {
                    elements[i].classList.remove("hidden");
                }
            }
        });
    }
    
    numStars(stars) {
        switch (stars) {
            case '★☆☆☆☆':
                return 1;
            case '★★☆☆☆':
                return 2;
            case '★★★☆☆':
                return 3;
            case '★★★★☆':
                return 4;
            case '★★★★★':
                return 5;
            default:
                return 0;
        }
    };
    
    enableStartPhase() {
        this.hideAllExcept("inProgressStart");
    }
    
    enablePhase1(shouldSetToView) {
        this.hideAllExcept("inProgressShow1");
        if (!!shouldSetToView) {
            this.setupToView();
        }
        this.displayKanji();
    }

    convertKanjiToJukugo() {
        const jukugoToView = [];
        let counter = 0;
        this.siteState.toView.forEach((currentKanjiIndex) => {
            const currentKanji = newLangData[currentKanjiIndex];
            if (currentKanji && currentKanji.jukugoList) {
                currentKanji.jukugoList.forEach(() => {
                    jukugoToView.push(counter);
                    counter++;
                });
            }
        });
        this.siteState.allCurrentKanji = JSON.parse(JSON.stringify(jukugoToView));
        this.siteState.toView = jukugoToView;
    }

    setupToView() {
        let start = 1;
        let end = 9999;

        for (var current = start; current <= end; current++) {
            const currentKanji = langDataToUse[current];
            if (currentKanji && 
                    (currentKanji.kunyomiList && currentKanji.kunyomiList.length || 
                    currentKanji.jukugoList && currentKanji.jukugoList.length)) {
                this.siteState.allCurrentKanji.push(current);
                this.siteState.toView.push(current);
            }
        }
        if (isJukugoTime) {
            this.convertKanjiToJukugo();   
        }
        if (!isSequential) {
            window.shuffle(this.siteState.toView);
        }
    }

    updateKanjiColor() {

        const kanji = document.getElementById("_currentKanji");

        const toneColorString = "toneColor";
        const toneColorClasses = [
            toneColorString + 0,
            toneColorString + 1,
            toneColorString + 2,
            toneColorString + 3,
            toneColorString + 4
        ];

        toneColorClasses.forEach((value) => {
            kanji.classList.remove(value);
        });
        const toneColorClass = isSingleCharMode ? toneColorClasses[this.siteState.currentKanji.tone] : toneColorClasses[0];
        kanji.classList.add(toneColorClass);
    }
    
    displayKanji() {
        this.siteState.currentKanji = langDataToUse[this.siteState.toView.shift()];
        this.siteState.storeValues();
        document.getElementById("_currentKanji").innerHTML = this.siteState.currentKanji.kanji;
        document.getElementById("_currentEng").innerHTML = this.siteState.currentKanji.eng;
        document.getElementById("_currentCompound").innerHTML = this.siteState.currentKanji.kunyomiList[0].compound;
        document.getElementById("_currentCompoundDefinition").innerHTML = this.siteState.currentKanji.kunyomiList[0].definition;
        document.getElementById("_currentStar").innerHTML = this.siteState.currentKanji.stars;
    
        const counter = this.siteState.allCurrentKanji.length - this.siteState.toView.length;
        document.querySelector("#_overallCounter").innerHTML = counter + "/" + this.siteState.allCurrentKanji.length;
        document.querySelector("#_scoreCounter").innerHTML = this.siteState.currentCorrect + "/" + this.siteState.currentCounter;
        document.querySelector("#_sentenceCounter").innerHTML = this.siteState.sentenceCounter + "/" + this.siteState.sentenceTotal;

        const topKunyomi = this.getTopKunyomiFromKanji(this.siteState.currentKanji);
        document.querySelector("#_currentHir").innerText = topKunyomi.hiragana;
        document.querySelector("#_currentCompoundPinyin").innerText = topKunyomi.compound_sound;
        document.querySelector("#_currentOnyomi").innerText = this.siteState.currentKanji.onyomi;
        
        document.querySelector("#_sentenceToChar").innerText = this.siteState.overview;

        this.updateKanjiColor();
    }

    getTopKunyomiFromKanji(kanji) {
        const kunyomiList = kanji.kunyomiList;
        let topKunyomi = null;
        if (kunyomiList.length) {
            const copiedValue = JSON.parse(JSON.stringify(kunyomiList));
            copiedValue.forEach((kunyomi) => {
                kunyomi.numStars = this.numStars(kunyomi.stars);
            });
            var sorted = copiedValue.sort((a,b) => b -a);
            if (sorted.length) {
                topKunyomi = sorted[0];
            }
        }
        return topKunyomi;
    }
    
    enablePhase2() {
        this.hideAllExcept("inProgressShow2");
        if (isSentenceMode) {
            document.getElementById("_currentStar").innerHTML = this.siteState.currentKanji.stars.slice(0,-1) + " - " + this.siteState.currentKanji.eng_def_for_sentence + ")";
        }
    }
    
    enableEndPhase() {
        this.hideAllExcept("inProgressEnd");
        if (!this.siteState.currentWrong.length) {
            document.querySelector(".inProgressEnd.review").classList.add("hidden");
        }
    }
    
    populateDialog(type, currentIndex) {
        this.hideAllExcept("inProgressDialog1");
        this.siteState.dialogCurrentType = type;
    
        const currentList = this.siteState.currentKanji[type + "List"];
        if (currentIndex < 0) {
            currentIndex = currentList.length - 1;
        }
        this.siteState.dialogCurrentIndex = currentIndex % currentList.length;
        this.siteState.dialogCurrentIndex = Number.isInteger(this.siteState.dialogCurrentIndex) ? this.siteState.dialogCurrentIndex : 0;
    
        const isJukugo = type === "jukugo";
        const currentValue = currentList[this.siteState.dialogCurrentIndex];
    
        document.getElementById("_dialogCounter").innerHTML = (this.siteState.dialogCurrentIndex + 1) + "/" + currentList.length;
        document.getElementById("_dialogOnyomi").innerHTML = isJukugo ? this.siteState.currentKanji.onyomi : "";
        document.getElementById("_dialogValue").innerHTML = currentValue[(isJukugo ? "kanji" : "hiragana")];
        document.getElementById("_dialogDefinition").innerHTML = currentValue.definition;
        document.getElementById("_dialogStar").innerHTML = currentValue.stars;
        document.getElementById("_dialogPhonetic").innerHTML = isJukugo ? currentValue.hiragana : "";
        let componentsToUse = currentValue.components;
        if (isJukugo && componentsToUse.indexOf("=") > -1) {
            const parts = componentsToUse.split("=");
            parts[1] = "<br />" + parts[1];
            componentsToUse = parts.join("=");
        }
        document.getElementById("_dialogComponents").innerHTML = isJukugo ? componentsToUse : "";
        document.getElementById("_dialogPrePart").innerHTML = currentValue.preparticles ? currentValue.preparticles : "";
        document.getElementById("_dialogPostPart").innerHTML = currentValue.postparticles ? currentValue.postparticles : "";
    }

    isHiraganaAndEngDiff(definition, english) {
        let engWords = english.split("/").join(" ");
        engWords = engWords.split(",").join(" ");
        engWords = engWords.split("-").join(" ");
        engWords = engWords.split(" ").filter((value) => {
            return !!value.trim().length;
        });
        return !engWords.every((word) => {
            return definition.indexOf(word) > -1;
        });
    }

    onHSKInput(value) {
        _sentenceDataInput = value;
        const selectedLevels = value.split(",").map((value) => { return Number.parseInt(value) });
        var highestLevel = 0;
        selectedLevels.forEach((level) => {
            if (level > highestLevel) {
                highestLevel = level;
            }
        });
        _highestChosenHSKLevel = highestLevel;
        value.split(",").map((numAsString) => {
            return hskLevelString + numAsString;
        }).forEach((hskLevelSelector) => {
            htmlToArray(document.querySelectorAll("." + hskLevelSelector + " input")).forEach((checkbox) => {
                checkbox.checked = true;
                checkbox.setAttribute("checked", "true");
            });
        });
    }
}

class TableBoard extends BaseBoard {

    enablePhase1(shouldSetToView) {
        this.hideAllExcept("inProgressShow1-table");
        if (!!shouldSetToView) {
            this.setupToView();
        }
        this.displayKanji();
    }

    enablePhase2() {
        this.hideAllExcept("inProgressShow2-table");
    }

    onHiraganaLinkPressed(element) {
        const value = JSON.parse(element.getAttribute("value"));
        const index = value.index;
        const definitions = document.querySelectorAll(".tableDefinition");
        if (window.getComputedStyle(definitions[index]).visibility === 'hidden') {
            return;
        }
        const isShowingDef = value.isShowingDef;
        const textToShow = isShowingDef ? value.eng : value.def;
        definitions[index].innerText = "- " + textToShow;
        value.isShowingDef = !value.isShowingDef;
        element.setAttribute("value", JSON.stringify(value));
    }

    onKanjiLinkPressed(element) {
        const value = JSON.parse(element.getAttribute("value"));
        const index = value.index;
        const currentKanji = this.siteState.currentKanjis[index];
        const kanjiIndex = Number.parseInt(currentKanji.index);
        if (this.siteState.currentWrong.indexOf(kanjiIndex) < 0) {
            this.siteState.currentWrong.push(Number.parseInt(currentKanji.index));
            this.siteState.storeValues();
        }
        element.classList.add("markedIncorrect");
    }

    createLinkForTable(identifier, payload) {
        const aElement = document.createElement("a");
        aElement.setAttribute("id", identifier);
        aElement.setAttribute("href", "#");
        const argument = JSON.stringify(payload);
        aElement.setAttribute("value", argument);
        return aElement;
    }

    displayKanji() {
        const table = document.querySelector("#_kanjiTable");
        const current = [];
        for (var i = 0; i < numRows; i++) {
            const nextNumber = this.siteState.toView.shift();
            const row = table.children[i];
            if (row.children[0].firstChild) {
                row.children[0].removeChild(row.children[0].firstChild);
            }
            if (row.children[1].firstChild) {
                row.children[1].removeChild(row.children[1].firstChild);
            }
            if (Number.isInteger(nextNumber)) {
                const currentKanji = langDataToUse[nextNumber];
                current.push(currentKanji);

                const kanjiAElement = this.createLinkForTable("kanjiLink-" + currentKanji.kanji, { index: i });
                kanjiAElement.innerText = currentKanji.kanji;
                kanjiAElement.setAttribute("onclick", "window.gameboard.onKanjiLinkPressed(this)");
                row.children[0].appendChild(kanjiAElement);

                let hiragana = this.getTopKunyomiFromKanji(currentKanji);
                if (hiragana) {
                    const hirElement = this.createLinkForTable("hiraganaLink-" + currentKanji.eng, { def : hiragana.definition, eng : currentKanji.eng, index: i, isShowingDef: false });
                    hirElement.setAttribute("onclick", "window.gameboard.onHiraganaLinkPressed(this)");
                    hirElement.innerText = hiragana.hiragana.replaceAll(' ', '');
                    
                    const isHiraganaAndEngDiff = this.isHiraganaAndEngDiff(hiragana.definition, currentKanji.eng);
                    hirElement.classList.add(isHiraganaAndEngDiff ? "differentHirAndEng" : "sameHirAndEng");
                    row.children[1].appendChild(hirElement);

                } else {
                    // row.children[1].innerText = currentKanji.onyomi;
                }
                row.children[2].innerText = " - " + currentKanji.eng;
            } else {
                row.children[0].innerText = "";
                row.children[1].innerText = "";
                row.children[2].innerText = "";
            }
        }
        this.siteState.currentKanjis = current;
        this.siteState.storeValues();

        const counter = this.siteState.allCurrentKanji.length - this.siteState.toView.length;
        document.querySelector("#_overallCounter").innerHTML = counter + "/" + this.siteState.allCurrentKanji.length;
        document.querySelector("#_scoreCounter").innerHTML = this.siteState.currentCorrect + "/" + this.siteState.currentCounter;
    }
    
    
    back() {
        if (this.siteState.wasViewed.length) {
            this.siteState.currentCounter-= numRows;
            this.siteState.currentCorrect-= numRows;
            this.siteState.toView.unshift(...this.siteState.currentKanjis.map((value) => { return Number.parseInt(value.index)}));
            const top = [];
            for (var i = 0; i < numRows; i++) {
                top.unshift(this.siteState.wasViewed.pop());
            }
            this.siteState.toView.unshift(...top);
            this.enablePhase1();
        } else {
            this.end();
        }
    }
    
    correct() {
        this.siteState.currentCounter+= numRows;
        this.siteState.currentCorrect+= numRows;
        this.siteState.wasViewed.push(...this.siteState.currentKanjis.map((value) => { return Number.parseInt(value.index)}));
        
        if (this.siteState.toView.length) {
            this.enablePhase1();
        } else {
            this.enableEndPhase();
        }
    }
    
    incorrect() {
        this.siteState.currentCounter+= numRows;
        this.siteState.toView.push(...this.siteState.currentKanjis.map((value) => { return Number.parseInt(value.index)}));
        if (!isSequential) {
            window.shuffleBackHalf(this.siteState.toView);
        }
        this.enablePhase1();
    }
}