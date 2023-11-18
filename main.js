/**
 * Site params
 */

const params = new URLSearchParams(window.location.search);
const currentSessionId = params.get("sessionId");
const numRows = Number.parseInt(params.get("numRows")) || 0;
const isJukugoTime = params.get("jukugo") === "true";

const isSequential = params.get("mode") !== "random";
const isSentenceMode = params.get("mode") == "sentence";
const showPinyin = params.get("showPinyin") == "true";
const isSingleCharMode = params.get("showSingle") == "true";
const isCompoundWordMode = params.get("showCompound") == "true";

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

var langDataToUse = {}; //newLangData;

const _hskLevelToSingleCharMap = {};
const _hskLevelToSentencedDataMap = {};

const charMap = {};
const charCountInValidSentences = {};

const charsToIgnore = [
    "。",
    "，",
    "?",
    "!",
    "！",
    "？",
    " "
];
const anyCharByHSKLevel = {};
charsToIgnore.forEach((value) => {
    anyCharByHSKLevel[value] = 1;
});

const hskLevelString = "hsk_level_";

var data = hskLevel1.concat(hskLevel2);

// pragma mark - setup

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
        }
    });

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

        if (isSentenceMode) {
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
             * 
             */
            if (value.character.length == 1) {

                if (!_hskLevelToSingleCharMap[value.hsk_level] ) {
                    _hskLevelToSingleCharMap[value.hsk_level] = {};
                }
                _hskLevelToSingleCharMap[value.hsk_level][value.character] = value;                

                // only capturing single chars
                charMap[value.character] = value;
            }
            if (value.character != value.compound && isValidSentence(value.hsk_level, value.compound)) {
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
                        compound : value.compound,
                        compound_pinyin : value.compound_pinyin,
                        compound_definition : value.compound_definition
                    };

                    _sentencedData[charAt][value.character] = {
                        compound : value.compound,
                        compound_pinyin : value.compound_pinyin,
                        compound_definition : value.compound_definition
                    };
                    delete charMap[charAt];
                }

                for (var j = 0; j < value.compound.length; j++) {
                    charCountInValidSentences[value.compound[j]] = charCountInValidSentences[value.compound[j]] + 1;
                }
            }
        }
    });
    console.log("Num chars excluded: " + Object.keys(charMap).length);

    if (isSentenceMode) {
        // code for checking excluded characters
        const sentenceCheck = [];
        data.forEach((value, index) => {
            const character = value.character;
            const sentenceForCharacter = value.compound;
            var excludedChars = "";
            const hskLevelForValue = value.hsk_level;
            for (var i = 0; i < sentenceForCharacter.length; i++) {
                const charAt = sentenceForCharacter[i];
                const currentCharHSKLevel = anyCharByHSKLevel[charAt];
                if (!currentCharHSKLevel || currentCharHSKLevel > hskLevelForValue) {
                    excludedChars = excludedChars + charAt;
                }
            }
            const compoundCount = value.character.length;
            const isValid = value.compound.length > value.character.length && excludedChars.length == 0;
            const numberOfAppearances = charCountInValidSentences[character] ? charCountInValidSentences[character] : 0;
            const separator = "%";
            sentenceCheck.push((index + 1) + 
            separator + character + 
            separator + hskLevelForValue + 
            separator + isValid + 
            separator + sentenceForCharacter + 
            separator + value.compound_pinyin + 
            separator + value.compound_definition + 
            separator + (excludedChars.length? excludedChars : ".") + 
            separator + compoundCount + 
            separator + numberOfAppearances);
        }); 
        const sentenceCheckAsString = sentenceCheck.join("\n");
        console.log(sentenceCheckAsString);
        console.log(charCountInValidSentences);
    }

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
}

const isValidSentence = function(hskLevel, sentence) {
    for (var i = 0; i < sentence.length; i++) {
        const currentChar = sentence[i];
        // a sentence is invalid if it doesn't appear at all or its minimum appearance is greater than the current hsk level
        const currentCharHSKLevel = anyCharByHSKLevel[currentChar];
        if (!currentCharHSKLevel || currentCharHSKLevel > hskLevel) {
            return false;
        }
    }
    return true;
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
        mergeTwoSentenceData(_sentencedData, sentencesToMerge);
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
        tone : mandarin.tone
        
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
        this.dialogCurrentType = "";
        this.dialogCurrentIndex = 0;
        this.currentWrong = [];
        this.currentKanjis = [];
    }

    clear() {
        this._setInitialValues()
        this.storeValues();
    }

    getValuesFromWindowName() {
        if (this.getPersistedValues().length) {
            const state = JSON.parse(this.getPersistedValues());
            this.allCurrentKanji = state.allCurrentKanji;
            this.wasViewed = state.wasViewed;
            this.toView = state.toView;
            this.currentKanji = state.currentKanji;
            this.currentCorrect = state.currentCorrect;
            this.currentCounter = state.currentCounter;
            this.dialogCurrentType = state.dialogCurrentType;
            this.dialogCurrentIndex = state.currentIndex;
            this.currentWrong = state.currentWrong;
            this.currentKanjis = state.currentKanjis;
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
    }

    getPersistedValues() {
        if (currentSessionId) {
            return localStorage[currentSessionId];
        } else {
            return localStorage.persistedValue;
        }
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
                    dialogCurrentType: this.dialogCurrentType,
                    dialogCurrentIndex: this.dialogCurrentIndex,
                    currentWrong: this.currentWrong,
                    currentKanjis : this.currentKanjis,
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
                    dialogCurrentType: this.dialogCurrentType,
                    dialogCurrentIndex: this.dialogCurrentIndex,
                    currentWrong: this.currentWrong,
                    currentKanjis : this.currentKanjis,
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

    if (isSentenceMode) {
        document.querySelector("#_currentKanji").classList.remove("kanji");
        document.querySelector("#_currentKanji").classList.add("kanjiSentence");
        document.querySelector("#_currentCompound").classList.remove("currentCompound");
        document.querySelector("#_currentCompound").classList.add("currentSentenceDefinition");
        document.querySelector("#_currentEng").classList.remove("pinyin");
        document.querySelector("#_currentEng").classList.add("pinyinSentence");
    }
    
    initializeData();
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
    window.gameboard = numRows === 0 ? new BaseBoard() : new TableBoard();
    gameboard.enableStartPhase();
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

class BaseBoard {
    constructor() {
        this.siteState = new KanjiState();
    }

    onInputStartChange(value) {
        const start = Number.parseInt(value);
        const end = document.getElementById("_inputEnd");
        end.value = start + 2999;
    }
    
    onStart(){
        var newLangData = [];
        if (!isSentenceMode) {
            const checkedBoxes = Array.prototype.slice.call(document.querySelectorAll('input[type=checkbox]:checked'));
            checkedBoxes.forEach(checkedBox => {
                const selectedHskLevel = checkedBox.parentElement.parentElement.querySelector(".hsk").innerText;
                const selectedPartOfSpeech = checkedBox.parentElement.parentElement.querySelector(".part_of_speech").innerText;
                newLangData = newLangData.concat(_groupedDataBy10[selectedHskLevel][selectedPartOfSpeech]);
            })
        } else {
            var index = 0;
            while (Object.keys(_sentencedData).length > 0) {
                const startAmount = Object.keys(_sentencedData).length;
                const keys = Object.keys(_sentencedData);
                const randomKey = keys[Math.floor(Math.random() * keys.length)];
                const charToUseMap = _sentencedData[randomKey];
                const charToUseKeys = Object.keys(charToUseMap);
                const randomChar = charToUseKeys[Math.floor(Math.random() * charToUseKeys.length)];
                const sentenceToUse = charToUseMap[randomChar];
                delete _sentencedData[randomKey];
                for (let i = 0; i < sentenceToUse.compound.length; i++) {
                    const charThatWillShow = sentenceToUse.compound[i];
                    delete charMap[charThatWillShow];
                    delete _sentencedData[charThatWillShow];
                }
                newLangData.push({
                    character: sentenceToUse.compound,
                    character_pinyin: sentenceToUse.compound_pinyin,
                    eng: "",
                    compound : sentenceToUse.compound_definition,
                    compound_cantonese : "",
                    compound_definition: "",
                    compound_pinyin: "",
                    hsk_level: "(" + randomChar + ")",
                    id: index,
                    part_of_speech: "sentence"
                });
                const endAmount = Object.keys(_sentencedData).length;
                console.log(sentenceToUse + " Start amount: " + startAmount + "; End amount: " + endAmount);
                index++;
            }
            Object.keys(charMap).forEach((charMapKey) => {
                const value = charMap[charMapKey];
                newLangData.push(value);
            });
            window.individualCharMap = charMap;
            console.log(Object.keys(charMap).join("%"));

            document.querySelector("#_sentenceToChar").innerText = "# sentences: " + index + "; # characters: " + Object.keys(charMap).length;
        }
        langDataToUse = {};
        newLangData.forEach((mandarinChar) => {
            convertMandarinToKanji(mandarinChar, langDataToUse);
        });

        this.enablePhase1(true);
    }
    
    onResume() {
        this.siteState.getValuesFromWindowName();
        if (!this.siteState.toView.length) {
            return;
        }
        this.enablePhase1(false);
    }
    
    onShow() {
        this.enablePhase2();  
    }
    
    back() {
        if (this.siteState.wasViewed.length) {
            this.siteState.currentCounter--;
            this.siteState.currentCorrect--;
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

        const topKunyomi = this.getTopKunyomiFromKanji(this.siteState.currentKanji);
        document.querySelector("#_currentHir").innerText = topKunyomi.hiragana;
        document.querySelector("#_currentCompoundPinyin").innerText = topKunyomi.compound_sound;
        document.querySelector("#_currentOnyomi").innerText = this.siteState.currentKanji.onyomi;

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
        if (isSentenceMode) {
            mergeSentenceData(value);
        } else {
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