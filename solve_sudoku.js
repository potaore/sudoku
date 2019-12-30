var exports = exports;
if (!exports) exports = {};
var solver = exports;
(function () {
    var version = "1.1.2";
    var CELL_LENGTH = 9;

    var hashMemo = [], hashMemoLog2 = [], hashLengthMemo = [];
    var lcCross = {}, blCross = {}, bcCross = {}, allCells, allCellsFromKey;
    var init = function () {
        for (var i = 0; i < 512; i++) {
            var array = [];
            var log2Array = [];
            for (var hash = i, num = 1; hash; hash = hash >> 1, num = num << 1) {
                if (!(hash & 1)) continue;
                array.push(num);
                log2Array.push(Math.log2(num) + 1);
            }
            hashMemo.push(array);
            hashMemoLog2.push(log2Array);
            hashLengthMemo.push(array.length);
        }

        for (var i = 1; i <= CELL_LENGTH; i++) {
            lcCross[i] = {};
            blCross[i] = {};
            bcCross[i] = {};
            for (var j = 1; j <= CELL_LENGTH; j++) {
                lcCross[i][j] = [i + "-" + j];
                blCross[i][j] = [];
                bcCross[i][j] = [];
            }
        }

        allCells = [];
        allCellsFromKey = {};
        for (var i = 1; i <= CELL_LENGTH; i++) {
            for (var j = 1; j <= CELL_LENGTH; j++) {
                var bi = Math.floor((j - 1) / 3) + Math.floor((i - 1) / 3) * 3 + 1;
                var cellName = i + "-" + j;
                var cell = { str: cellName, i: i, j: j, bi, bi };
                allCells.push(cell);
                blCross[bi][i].push(cellName);
                bcCross[bi][j].push(cellName);
                allCellsFromKey[cellName] = cell;
            }
        }
    };


    var infomations = {
        callCount: 0,
        maxDepth: 1,
        decideCandidateRemoveCount: 0,
        blockAndLineColumnPatternsRemoveCount: 0,
        singleNumberPatternRemoveCount: 0,
        blocksPatternRemoveCount: 0
    };

    var clearInfomations = function () {
        infomations = {
            callCount: 0,
            maxDepth: 1,
            decideCandidateRemoveCount: 0,
            blockAndLineColumnPatternsRemoveCount: 0,
            singleNumberPatternRemoveCount: 0,
            blocksPatternRemoveCount: 0
        };
    };

    var getInfomations = function () {
        return infomations;
    };

    var analizeSudoku = function (q) {
        return solveSudoku(transformQToBit(q), 1, true);
    };

    var transformQToBit = function (q) {
        var bq = [];
        for (var i = 0; i < CELL_LENGTH; i++) {
            var line = [];
            for (var j = 0; j < CELL_LENGTH; j++) {
                var num = q[i][j];
                if (num) {
                    line.push(1 << (num - 1));
                } else {
                    line.push(0);
                }
            }
            bq.push(line);
        }
        return bq;
    };

    var solveSudoku = function (q, depth, checkDupSol, memoMap) {
        infomations.callCount++;
        if (!depth) depth = 1;
        if (depth > infomations.maxDepth) infomations.maxDepth = depth;
        var useMemoMap = false;
        if (!memoMap) {
            memoMap = getNewMemoMap();
        } else {
            useMemoMap = true;
        }
        var leftCandidates = {};

        var lines = {};
        var columns = {};
        var blocks = {};
        var countMemo = {
            lines: {},
            columns: {},
            blocks: {},
            numbersMemo: {
                lines: {},
                columns: {},
                blocks: {},
            }
        };

        var removeCount = 0;
        var result = { err: false, removeCount: 0 };
        var solved = false;
        initQuestion(q, memoMap, leftCandidates, lines, columns, blocks, countMemo, useMemoMap);

        result = { err: false, removeCount: 0 };
        for (var i = 1; i <= CELL_LENGTH; i++) {
            for (var j = 1; j <= CELL_LENGTH; j++) {
                var str = i + "-" + j;
                if (q[i - 1][j - 1]) {
                    var candidatesObj = leftCandidates[str];
                    if (!candidatesObj) continue;
                    deleteAllCandedatesInitQ(leftCandidates, lines, columns, blocks, candidatesObj, q[i - 1][j - 1], result, countMemo);
                }
            }
        }

        for (var i = 1; i <= CELL_LENGTH; i++) {
            for (var j = 1; j <= CELL_LENGTH; j++) {
                if (q[i - 1][j - 1]) {
                    var candidatesObj = leftCandidates[i + "-" + j];
                    if (candidatesObj) {
                        if (!decideCandidates(leftCandidates, lines, columns, blocks, candidatesObj.str, q[i - 1][j - 1], result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
                    }
                }
            }
        }

        infomations.decideCandidateRemoveCount += result.removeCount;

        if (Object.keys(leftCandidates).length === 0) {
            solved = true;
        }

        var looped = false;
        while (!solved) {
            removeCount = 0;
            result.removeCount = 0;

            if (!removeBySingleNumberPatternAll(leftCandidates, lines, columns, blocks, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
            removeCount += result.removeCount;

            if (Object.keys(leftCandidates).length === 0) {
                solved = true;
                break;
            }
            if (looped) break;
            removeCount = 0;
            result.removeCount = 0;
            if (Object.keys(leftCandidates).length >= 70) break;


            var bKeys = Object.keys(blocks);
            for (var idxb = 0, lenb = bKeys.length; idxb < lenb; idxb++) {
                if (!removeByBlockAndLineColumnPatterns(leftCandidates, lines, columns, blocks, blocks[bKeys[idxb]], bKeys[idxb], result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
            }
            if (Object.keys(leftCandidates).length === 0) {
                solved = true;
                break;
            }

            //if (!removeByBlocksPatternAll(leftCandidates, lines, columns, blocks, result, countMemo)) return false;
            //if (Object.keys(leftCandidates).length === 0) {
            //    solved = true;
            //    break;
            //}

            if (!removeByChain(leftCandidates, lines, columns, blocks, result, countMemo)) return false;

            removeCount += result.removeCount;
            if (removeCount == 0) {
                break;
            }
            looped = true;
        }

        var leftKeys = Object.keys(leftCandidates);
        if (leftKeys.length === 0) {
            if (validateMemoMap(memoMap)) {
                return { result: true, dup: false, invalid: false, memoMap: memoMap, msg: "solved", countMemo: countMemo };
            } else {
                return { result: false, dup: false, invalid: true, memoMap: memoMap, msg: "no solution", countMemo: countMemo };
            }
        } else {
            var firstResult = null;
            var candidatesObj = null;
            var minNum = 100;
            var minNumObj = null;
            for (var leftIdx = 0; leftIdx < leftKeys.length; leftIdx++) {
                candidatesObj = leftCandidates[leftKeys[leftIdx]];
                var num = candidatesObj.candidates.length;
                if (num < minNum) {
                    minNum = num;
                    minNumObj = candidatesObj;
                    if (num == 2) break;
                }
            }
            candidatesObj = minNumObj;
            var candidates = hashMemo[candidatesObj.candidates.hash];
            var firstResult = null;
            for (var len = candidates.length, idx = len - 1; idx >= 0; idx--) {
                var candidate = candidates[idx];
                var q1 = createQuestionFromMemoMap(memoMap, candidatesObj.i, candidatesObj.j, candidate);
                var result = solveSudoku(q1[0], depth + 1, checkDupSol, q1[1]);

                if (result.result) {
                    if (result.secondResult) {
                        return result;
                    }
                    if (firstResult) {
                        firstResult.secondResult = result;
                        firstResult.dup = true;
                        firstResult.msg = "not single solution";
                        return firstResult;
                    } else {
                        firstResult = result;
                        if (!checkDupSol) return firstResult;
                    }
                }
            }
            if (firstResult) {
                return firstResult;
            }
        }
        return { result: false, dup: false, invalid: true, memoMap: memoMap, msg: "no solution" };
    };

    var initQuestion = function (q, memoMap, leftCandidates, lines, columns, blocks, countMemo, useMemoMap) {
        var linesMemoMap = {};
        var columnsMemoMap = {};
        var blocksMemoMap = {};

        var linesNumbersMemo = {};
        var columnsNumbersMemo = {};
        var bloksNumbersMemo = {};

        for (var listIndex = 1; listIndex <= CELL_LENGTH; listIndex++) {
            var lineMemo = linesNumbersMemo[listIndex] = {};
            var columnMemo = columnsNumbersMemo[listIndex] = {};
            var blockMemo = bloksNumbersMemo[listIndex] = {};

            for (var num = 0; num < CELL_LENGTH; num++) {
                var hash = 1 << num;
                if (useMemoMap) {
                    lineMemo[hash] = 0;
                    columnMemo[hash] = 0;
                    blockMemo[hash] = 0;
                } else {
                    lineMemo[hash] = CELL_LENGTH;
                    columnMemo[hash] = CELL_LENGTH;
                    blockMemo[hash] = CELL_LENGTH;
                }
            }
        }

        if (useMemoMap) {
            iterateAllCell(function (str, i, j, bi) {
                var memo = memoMap[str];
                for (var num = 0; num < CELL_LENGTH; num++) {
                    var hash = 1 << num;
                    if (memo.hash & hash) {
                        linesNumbersMemo[i][hash]++;
                        columnsNumbersMemo[j][hash]++;
                        bloksNumbersMemo[bi][hash]++;
                    }
                }
                return true;
            });
        }

        countMemo.numbersMemo = { lines: linesNumbersMemo, columns: columnsNumbersMemo, blocks: bloksNumbersMemo };
        for (var num1 = 1; num1 <= CELL_LENGTH; num1++) {
            lines[num1] = {};
            columns[num1] = {};
            blocks[num1] = {};
            countMemo.lines[num1] = getNewNumberMemo();
            countMemo.columns[num1] = getNewNumberMemo();
            countMemo.blocks[num1] = getNewNumberMemo();
        }

        iterateAllCell(function (str, i, j, bi) {
            var candidates = memoMap[str];
            lines[i][str] = candidates;
            columns[j][str] = candidates;
            blocks[bi][str] = candidates;

            var cndObj = leftCandidates[str] = {
                str: str,
                i: i,
                j: j,
                bi: bi,
                candidates: memoMap[str],
                line: lines[i],
                column: columns[j],
                block: blocks[bi],
                lefts: {}
            };

            (linesMemoMap[i] ? linesMemoMap[i] : linesMemoMap[i] = []).push(cndObj);
            (columnsMemoMap[j] ? columnsMemoMap[j] : columnsMemoMap[j] = []).push(cndObj);
            (blocksMemoMap[bi] ? blocksMemoMap[bi] : blocksMemoMap[bi] = []).push(cndObj);
            return true;
        });

        iterateAllCell(function (str, i, j, bi) {
            var candidatesObj = leftCandidates[str];
            var candidates = candidatesObj.candidates;
            for (var idx1 = 0, line = linesMemoMap[i], len1 = line.length; idx1 < len1; idx1++) line[idx1].lefts[str] = candidates;
            for (var idx2 = 0, colmn = columnsMemoMap[j], len2 = colmn.length; idx2 < len2; idx2++) colmn[idx2].lefts[str] = candidates;
            for (var idx3 = 0, block = blocksMemoMap[bi], len3 = block.length; idx3 < len3; idx3++) block[idx3].lefts[str] = candidates;
            delete candidatesObj.lefts[str];
            return true;
        });
    };

    var getNewMemoMap = function () {
        var memoMap = {};
        for (var i = 1; i <= CELL_LENGTH; i++)
            for (var j = 1; j <= CELL_LENGTH; j++)
                memoMap[i + "-" + j] = { hash: 511, length: 9, key: i + "-" + j };
        return memoMap;
    };

    var getNewNumberMemo = function () {
        return { 1: true, 2: true, 4: true, 8: true, 16: true, 32: true, 64: true, 128: true, 256: true };
    };

    var deleteAllCandedatesInitQ = function (leftCandidates, lines, columns, blocks, candidatesObj, decidedNumber, result, countMemo) {
        var delHash = candidatesObj.candidates.hash - decidedNumber;
        for (var dellNums = hashMemo[delHash], i = 0, len = dellNums.length; i < len; i++) {
            deleteCandidateInitQ(leftCandidates, lines, columns, blocks, candidatesObj, dellNums[i], result, countMemo);
        }
    };

    var deleteCandidateInitQ = function (leftCandidates, lines, columns, blocks, candidatesObj, deleteNumber, result, countMemo) {
        candidatesObj.candidates.hash -= deleteNumber;
        candidatesObj.candidates.length--;
        countMemo.numbersMemo.lines[candidatesObj.i][deleteNumber]--;
        countMemo.numbersMemo.columns[candidatesObj.j][deleteNumber]--;
        countMemo.numbersMemo.blocks[candidatesObj.bi][deleteNumber]--;
    };

    var deleteAllCandedates = function (leftCandidates, lines, columns, blocks, candidatesObj, decidedNumber, result, countMemo) {
        var candidates = candidatesObj.candidates;
        candidates = hashMemo[candidates.hash];
        var len = candidates.length;
        if (len == 1) {
            if (!decideCandidates(leftCandidates, lines, columns, blocks, candidatesObj.str, decidedNumber, result, countMemo)) {
                return false;
            } else {
                return true;
            }
        }
        for (var idx = 0; idx < len; idx++) {
            var num = candidates[idx];
            if ((candidatesObj.candidates.hash & num) && decidedNumber != num) {
                if (!leftCandidates[candidatesObj.str]) break;
                if (!deleteCandidate(leftCandidates, lines, columns, blocks, candidatesObj, num, result, countMemo)) {
                    return false;
                }
            }
        }
        return true;
    };

    var deleteCandidate = function (leftCandidates, lines, columns, blocks, candidatesObj, deleteNumber, result, countMemo) {
        var candidates = candidatesObj.candidates;
        if (!(candidates.hash & deleteNumber)) return true;
        candidates.hash -= deleteNumber;
        candidates.length--;
        var line = countMemo.numbersMemo.lines[candidatesObj.i];
        line[deleteNumber]--;
        var column = countMemo.numbersMemo.columns[candidatesObj.j];
        column[deleteNumber]--;
        var block = countMemo.numbersMemo.blocks[candidatesObj.bi];
        block[deleteNumber]--;

        if (line[deleteNumber] == 0 || column[deleteNumber] == 0 || block[deleteNumber] == 0) {
            return false;
        }

        if (candidates.hash === 0) return !(result.err = true);

        if (candidates.length === 1)
            if (!decideCandidates(leftCandidates, lines, columns, blocks, candidatesObj.str, candidates.hash, result, countMemo)) {
                return false;
            }

        if (countMemo.lines[candidatesObj.i][deleteNumber] && line[deleteNumber] == 1) {
            if (!decideSingleNumberInList2(leftCandidates, lines, columns, blocks, candidatesObj.line, deleteNumber, result, countMemo)) {
                return false;
            }
        }
        if (countMemo.columns[candidatesObj.j][deleteNumber] && column[deleteNumber] == 1) {
            if (!decideSingleNumberInList2(leftCandidates, lines, columns, blocks, candidatesObj.column, deleteNumber, result, countMemo)) {
                return false;
            }
        }
        if (countMemo.blocks[candidatesObj.bi][deleteNumber] && block[deleteNumber] == 1) {
            if (!decideSingleNumberInList2(leftCandidates, lines, columns, blocks, candidatesObj.block, deleteNumber, result, countMemo)) {
                return false;
            }
        }
        return true;
    };

    var iterateAllCell = function (func) {
        for (var i = 0, len = allCells.length; i < len; i++) {
            var cell = allCells[i];
            if (!func(cell.str, cell.i, cell.j, cell.bi)) return false;
        }
        return true;
    };

    var endAsError = function (memoMap, leftCandidates, lines, columns, blocks) {
        return { result: false, dup: false, invalid: true, memoMap: memoMap, err: true, msg: "no solution" };
    };

    var decideCandidates = function (leftCandidates, lines, columns, blocks, key, decidedNumber, result, countMemo) {
        var candidatesObj = leftCandidates[key];
        delete candidatesObj.line[key];
        delete candidatesObj.column[key];
        delete candidatesObj.block[key];
        countMemo.lines[candidatesObj.i][decidedNumber] = false;
        countMemo.columns[candidatesObj.j][decidedNumber] = false;
        countMemo.blocks[candidatesObj.bi][decidedNumber] = false;
        delete leftCandidates[key];
        return removeCandidatesFromList(leftCandidates, lines, columns, blocks, candidatesObj.lefts, decidedNumber, key, result, countMemo);
    };

    var removeCandidatesFromList = function (leftCandidates, lines, columns, blocks, list, decidedNumber, key, result, countMemo) {
        var lKeys = Object.keys(list);
        for (var idx = 0, len = lKeys.length; idx < len; idx++) {
            var candidatesObj = leftCandidates[lKeys[idx]];
            if (!candidatesObj) continue;
            delete candidatesObj.lefts[key];
            var lCandidates = list[lKeys[idx]];
            if (lCandidates.hash & decidedNumber) {
                if (!deleteCandidate(leftCandidates, lines, columns, blocks, candidatesObj, decidedNumber, result, countMemo)) {
                    return false;
                }
                result.removeCount++;
            }
        }
        return true;
    };

    var decideSingleNumberInList2 = function (leftCandidates, lines, columns, blocks, list, number, result, countMemo) {
        var listKeys = Object.keys(list);
        for (var idx = 0, len = listKeys.length; idx < len; idx++) {
            var key = listKeys[idx];
            if (list[key].hash & number) {
                if (!leftCandidates[key]) return true;
                if (!deleteAllCandedates(leftCandidates, lines, columns, blocks, leftCandidates[key], number, result, countMemo)) {
                    return false;
                }
                return true;
            }
        }
        console.log("number " + number + " not found");
        return false;
    };

    var removeByBlockAndLineColumnPatterns = function (leftCandidates, lines, columns, blocks, block, bi, result, countMemo) {
        var keys = Object.keys(block);
        var len1 = keys.length;
        if (len1 <= 1) return true;

        var workList = [];
        var generaLGroup = [];
        var lineCountMemo = {};
        var columnCountMemo = {};
        var noNeedLineCheck = true;
        var noNeedColumnCheck = true;
        var linePatternMemo = {};
        var columnPatternMemo = {};
        var solvedNumberMemo = [];
        for (var idx1 = 0; idx1 < len1; idx1++) {
            var candidates = block[keys[idx1]];
            var nums = candidates.hash;
            generaLGroup.push(nums);
            var cndObj = leftCandidates[keys[idx1]];
            if (!lineCountMemo[cndObj.i]) lineCountMemo[cndObj.i] = 0;
            lineCountMemo[cndObj.i]++;
            if (lineCountMemo[cndObj.i] >= 1) noNeedLineCheck = false;
            if (!columnCountMemo[cndObj.j]) columnCountMemo[cndObj.j] = 0;
            columnCountMemo[cndObj.j]++;
            if (columnCountMemo[cndObj.j] >= 1) noNeedColumnCheck = false;
            if (!linePatternMemo[cndObj.i]) linePatternMemo[cndObj.i] = {};
            if (!columnPatternMemo[cndObj.j]) columnPatternMemo[cndObj.j] = {};
            solvedNumberMemo.push(0);
            workList.push(cndObj);
        }

        if (noNeedLineCheck && noNeedColumnCheck) return true;
        var lKeys = Object.keys(lineCountMemo);
        var cKeys = Object.keys(columnCountMemo);

        var linesGeneral = {};
        var columnsGeneral = {};
        for (var li = 0, len = lKeys.length; li < len; li++) {
            linesGeneral[lKeys[li]] = getGeneralNumGroupRemovedBlock(leftCandidates, lines[lKeys[li]], bi);
        }
        for (var ci = 0, len = cKeys.length; ci < len; ci++) {
            columnsGeneral[cKeys[ci]] = getGeneralNumGroupRemovedBlock(leftCandidates, columns[cKeys[ci]], bi);
        }

        for (var idx1 = 0; idx1 < len1; idx1++) {
            var numsHash = generaLGroup[idx1];
            var cndObj = workList[idx1];
            for (var idx2 = 0, nums = hashMemo[numsHash]; idx2 < nums.length; idx2++) {
                if (cndObj.candidates.length === 1) break;
                var num = nums[idx2];
                var tempGroup = generaLGroup.concat();
                tempGroup[idx1] = num;
                if (solvedNumberMemo[idx1] & num) continue;
                var foundCrossPattern = false;
                iterateGroupPatterns2(tempGroup, 0, len1, function (pattern) {
                    var lWork = {};
                    var cWork = {};
                    for (var index2 = 0; index2 < len1; index2++) {
                        var cndObj = workList[index2];
                        if (!lWork[cndObj.i]) lWork[cndObj.i] = 0;
                        if (!cWork[cndObj.j]) cWork[cndObj.j] = 0;
                        lWork[cndObj.i] += pattern[index2];
                        cWork[cndObj.j] += pattern[index2];
                    }

                    for (var i3 = 0, len3 = lKeys.length; i3 < len3; i3++) {
                        var lKey = lKeys[i3];
                        var hash = lWork[lKey];
                        if (linePatternMemo[lKey][hash]) {
                            if (linePatternMemo[lKey][hash].result) continue;
                            else return true;
                        }
                        var lGroup = getRemovedNumsGroupGeneral(linesGeneral[lKey], hash);
                        if (!findGroupPattern2(lGroup)) {
                            linePatternMemo[lKey][hash] = { result: false };
                            return true;
                        } else {
                            linePatternMemo[lKey][hash] = { result: true };
                        }
                    }

                    for (var i4 = 0, len4 = cKeys.length; i4 < len4; i4++) {
                        var cKey = cKeys[i4];
                        var hash = cWork[cKey];
                        if (columnPatternMemo[cKey][hash]) {
                            if (columnPatternMemo[cKey][hash].result) continue;
                            else return true;
                        }

                        var cGroup = getRemovedNumsGroupGeneral(columnsGeneral[cKey], hash);
                        if (!findGroupPattern2(cGroup)) {
                            columnPatternMemo[cKey][hash] = { result: false };
                            return true;
                        } else {
                            columnPatternMemo[cKey][hash] = { result: true };
                        }
                    }

                    for (var pi = 0; pi < len1; pi++) {
                        solvedNumberMemo[pi] |= pattern[pi];
                    }

                    foundCrossPattern = true;
                    return false;
                });
                if (!foundCrossPattern) {
                    var candidatesObj = leftCandidates[keys[idx1]];
                    if (!candidatesObj) continue;
                    infomations.blockAndLineColumnPatternsRemoveCount++;
                    result.removeCount++;
                    if (!deleteCandidate(leftCandidates, lines, columns, blocks, candidatesObj, num, result, countMemo)) return false;
                }
            }
        }
        return true;
    };

    var getGeneralNumGroupRemovedBlock = function (leftCandidates, group, removedBlockIndex) {
        var numsGroup = [];
        var keys = Object.keys(group);
        for (var idx1 = 0, len1 = keys.length; idx1 < len1; idx1++) {
            var cndObj = leftCandidates[keys[idx1]];
            if (cndObj.bi == removedBlockIndex) continue;
            var nums = cndObj.candidates.hash;
            numsGroup.push(nums);
        }
        return numsGroup;
    };

    var iterateGroupPatterns2 = function (group, startIndex, length, callBack) {
        if (length === 0) return callBack([]);
        var subGroup = [];
        var indexes = [];
        for (var i = startIndex, len = startIndex + length; i < len; i++) {
            subGroup.push(group[i]);
            indexes.push(0);
        }
        group = subGroup;
        if (!optimizeGroup(group, length)) return false;

        var doIncliment = false;
        var doDeclimentPointing = false;
        var pointingIndex = 0;
        var pattern = [];
        var usedNumberHash = 0;
        var pointingMember = hashMemo[group[0]];
        var pointingNum;
        while (true) {
            if (doDeclimentPointing) {
                indexes[pointingIndex] = 0;
                pointingIndex--;
                usedNumberHash -= pattern.pop();
                if (pointingIndex < 0) return;
                doIncliment = true;
                pointingMember = hashMemo[group[pointingIndex] - (usedNumberHash & group[pointingIndex])];
                doDeclimentPointing = false;
            }

            if (doIncliment) {
                indexes[pointingIndex]++;
                if (indexes[pointingIndex] === pointingMember.length) {
                    doDeclimentPointing = true;
                    continue;
                }
                doIncliment = false;
            }
            pointingNum = pointingMember[indexes[pointingIndex]];
            pattern.push(pointingNum);
            usedNumberHash += pointingNum;
            if (pointingIndex + 1 === length) {
                if (!callBack(pattern)) return;
                doIncliment = true;
                usedNumberHash -= pattern.pop();
            } else {
                pointingIndex++;
                pointingMember = hashMemo[group[pointingIndex] - (usedNumberHash & group[pointingIndex])];
                if (pointingMember.length === 0) doDeclimentPointing = true;
            }
        }
    };

    var optimizeGroup = function (group, endIndex) {
        var len1Indexes = [];
        for (var i = 0; i < endIndex; i++) {
            var member = group[i];
            if (member === 0) {
                return false;
            } else if (hashLengthMemo[member] === 1) {
                len1Indexes.push(i);
            }
        }

        var len1;
        while (len1 = len1Indexes.length) {
            var len1IndexesNext = [];
            for (var l1i = 0; l1i < len1; l1i++) {
                var self = len1Indexes[l1i];
                var num = group[self];
                for (var i = 0; i < endIndex; i++) {
                    if (i != self) {
                        var member = group[i];
                        if ((num & member)) {
                            member -= num;
                            if (member === 0) {
                                return false;
                            } else if (hashLengthMemo[member] === 1) {
                                len1IndexesNext.push(i);
                            }
                            group[i] = member;
                        }
                    }
                }
            }
            len1Indexes = len1IndexesNext;
        }
        return true;
    };


    var findGroupPattern2 = function (group) {
        var gLen = group.length;
        if (gLen === 0) return true;
        if (!optimizeGroup(group, gLen)) return false;
        if (gLen === 1) return true;

        var firstMember = hashMemo[group[0]];
        for (var i = 0, len = firstMember.length; i < len; i++) {
            var num = firstMember[i];
            var usedNumberHash = num;
            if (findGroupPattern2Sub(group, gLen, usedNumberHash, 1)) return true;
        }
        return false;
    };

    var findGroupPattern2Sub = function (group, length, usedNumberHash, memberIndex) {
        var pointingMember = hashMemo[group[memberIndex] - (usedNumberHash & group[memberIndex])];
        for (var i = 0, len = pointingMember.length; i < len; i++) {
            var num = pointingMember[i];
            var usedNumberHashNext = usedNumberHash + num;
            if (memberIndex + 1 === length) return true;
            if (findGroupPattern2Sub(group, length, usedNumberHashNext, memberIndex + 1)) return true;
        }
        return false;
    };

    var getRemovedNumsGroupGeneral = function (group, nums) {
        var newGroup = [];
        var len = group.length;
        for (var i = 0; i < len; i++) {
            var member = group[i];
            member -= member & nums;
            newGroup.push(member);
        }
        return newGroup;
    };

    var removeByBlocksPatternAll = function (leftCandidates, lines, columns, blocks, result, countMemo) {
        if (!removeByBlocksPattern(leftCandidates, lines, columns, blocks, 1, 2, 3, "i", result, countMemo)) return false;
        if (!removeByBlocksPattern(leftCandidates, lines, columns, blocks, 4, 5, 6, "i", result, countMemo)) return false;
        if (!removeByBlocksPattern(leftCandidates, lines, columns, blocks, 7, 8, 9, "i", result, countMemo)) return false;
        if (!removeByBlocksPattern(leftCandidates, lines, columns, blocks, 1, 4, 7, "j", result, countMemo)) return false;
        if (!removeByBlocksPattern(leftCandidates, lines, columns, blocks, 2, 5, 8, "j", result, countMemo)) return false;
        if (!removeByBlocksPattern(leftCandidates, lines, columns, blocks, 3, 6, 9, "j", result, countMemo)) return false;
        return true;
    };

    var removeByBlocksPattern = function (leftCandidates, lines, columns, blocks, bi1, bi2, bi3, gKey, result, countMemo) {
        var block1Objs = getCndObjArray(leftCandidates, blocks[bi1]);
        var block2Objs = getCndObjArray(leftCandidates, blocks[bi2]);
        var block3Objs = getCndObjArray(leftCandidates, blocks[bi3]);
        var b1len = block1Objs.length;
        var b2len = block2Objs.length;
        var b3len = block3Objs.length;
        var alen = b1len + b2len + b3len;
        if (alen >= 12) return true;
        var allObjs = block1Objs.concat(block2Objs).concat(block3Objs);
        var groupIndexTargets = {};
        var groupIndexList = [];
        var giList = [];
        var solvedNums = [];
        for (var ai = 0; ai < alen; ai++) {
            var cndObj = allObjs[ai];
            var gi = cndObj[gKey];
            (groupIndexTargets[gi] ? groupIndexTargets[gi] : groupIndexTargets[gi] = []).push(ai);
            groupIndexList.push(gi);
            solvedNums.push(0);
            if (giList.indexOf(gi) == -1) {
                giList.push(gi);
            }
        }

        var resultHash2 = {};
        var resultHash3 = {};
        for (var ai = 0; ai < alen; ai++) {
            var cndObj = allObjs[ai];
            for (var ni = 0, nums = hashMemo[cndObj.candidates.hash], nlen = nums.length; ni < nlen; ni++) {
                if (cndObj.candidates.length == 1) break;
                var num = nums[ni];
                if (solvedNums[ai] & num) continue;
                var allCells1 = getCandidatesFromObj(allObjs);
                var foundPattern = false;
                if (removeNumGroup(allCells1, groupIndexList, groupIndexTargets, ai, 0, num)) {
                    allCells1[ai] = num;
                } else {
                    allCells1[0] = 0;
                }

                iterateGroupPatterns2(allCells1, 0, b1len, function (b1pattern) {
                    var _gil = groupIndexList, _git = groupIndexTargets;
                    var hash2 = getBlockHash(b1pattern, groupIndexList, giList, 0);
                    if (resultHash2[hash2] && !resultHash2[hash2].foundPatternB2) {
                        return true;
                    }
                    if (cndObj.bi == bi1) resultHash2[hash2] = { foundPatternB2: false };
                    var allCells2 = allCells1.slice(b1len);

                    for (var b1pi = 0, _b1len = b1len; b1pi < _b1len; b1pi++)
                        if (!removeNumGroup(allCells2, _gil, _git, b1pi, _b1len, b1pattern[b1pi])) return true;

                    iterateGroupPatterns2(allCells2, 0, b2len, function (b2pattern) {
                        var __gil = _gil, __git = _git;
                        resultHash2[hash2] = { foundPatternB2: true };
                        var hash3 = hash2 + getBlockHash(b2pattern, groupIndexList, giList, b1len);
                        if (resultHash3[hash3] && !resultHash3[hash3].foundPatternB3) {
                            return true;
                        }
                        if (cndObj.bi != bi3) resultHash3[hash3] = { foundPatternB3: false };
                        var allCells3 = allCells2.slice(b2len);
                        for (var b2pi = 0, __b1len = b1len, _b2len = b2len; b2pi < _b2len; b2pi++)
                            if (!removeNumGroup(allCells3, __gil, __git, b2pi + __b1len, __b1len + _b2len, b2pattern[b2pi])) return true;

                        iterateGroupPatterns2(allCells3, 0, b3len, function (b3pattern) {
                            var _b1pattern = b1pattern, _b2pattern = b2pattern;
                            resultHash3[hash3] = { foundPatternB3: true };
                            foundPattern = true;
                            var _svnms = solvedNums;
                            var sci = 0;
                            for (var b1i = 0, _l1 = __b1len; b1i < _l1; b1i++) _svnms[sci++] |= _b1pattern[b1i];
                            for (var b2i = 0, _l2 = _b2len; b2i < _l2; b2i++) _svnms[sci++] |= _b2pattern[b2i];
                            for (var b3i = 0, _l3 = b3pattern.length; b3i < _l3; b3i++) _svnms[sci++] |= b3pattern[b3i];
                            return false;
                        });
                        return !foundPattern;
                    });
                    return !foundPattern;
                });

                if (!foundPattern) {
                    infomations.blocksPatternRemoveCount++;
                    result.removeCount++;
                    if (!deleteCandidate(leftCandidates, lines, columns, blocks, cndObj, num, result, countMemo)) return false;
                }
            }
        }
        return true;
    };

    var getCndObjArray = function (leftCandidates, group) {
        var members = [];
        for (var keys = Object.keys(group), i = 0, len = keys.length; i < len; i++) members.push(leftCandidates[keys[i]]);
        return members;
    };

    var getCandidatesFromObj = function (group) {
        var members = [];
        for (var i = 0, len = group.length; i < len; i++) members.push(group[i].candidates.hash);
        return members;
    };

    var removeNumGroup = function (allCells, groupIndexList, groupIndexTargets, ai, startAi, num) {
        var crossGroupIndexList = groupIndexTargets[groupIndexList[ai]];
        for (var cgii = 0, cglen = crossGroupIndexList.length; cgii < cglen; cgii++) {
            var cgi = crossGroupIndexList[cgii];
            if (cgi < startAi) continue;
            cgi -= startAi;
            allCells[cgi] -= (allCells[cgi] & num);
            if (allCells[cgi] === 0) return false;
        }
        return true;
    };

    var getBlockHash = function (blockPattern, groupIndexList, giList, indexOffset) {
        var gNums = {};
        for (var i = 0, gilen = giList.length; i < gilen; i++) {
            gNums[giList[i]] = 0;
        }

        for (var i = 0, len = blockPattern.length; i < len; i++) {
            var gi = groupIndexList[i + indexOffset];
            gNums[gi] += blockPattern[i];
        }

        var hash = 0;
        for (var i = 0; i < gilen; i++) {
            var nums = gNums[giList[i]];
            if (nums === 0) continue;
            hash += nums << (i * 10);
        }
        return hash;
    };

    var removeBySingleNumberPatternAll = function (leftCandidates, lines, columns, blocks, result, countMemo) {
        for (var idx = 0; idx < CELL_LENGTH; idx++) {
            var num = 1 << idx;
            if (!removeBySingleNumberPattern(leftCandidates, lines, columns, blocks, num, result, countMemo)) return false;
        }
        return true;
    };

    var removeBySingleNumberPattern = function (leftCandidates, lines, columns, blocks, num, result, countMemo) {
        var leftCount = CELL_LENGTH;
        var numberLeftCandidates = [];
        var numberLeftBlocks = [];
        var bKeys = [];
        for (var groupIndex = 1; groupIndex <= CELL_LENGTH; groupIndex++) {
            if (countMemo.blocks[groupIndex][num]) {
                var block = blocks[groupIndex];
                var blockCandidates = [];
                numberLeftBlocks.push(blockCandidates);
                bKeys.push(groupIndex);
                var bKey = Object.keys(block);
                for (var mi = 0, len = bKey.length; mi < len; mi++) {
                    var cnd = leftCandidates[bKey[mi]];
                    if (cnd.candidates.hash & num) {
                        numberLeftCandidates.push(cnd);
                        blockCandidates.push(cnd);
                    }
                }
            } else {
                leftCount--;
            }
        }

        if (leftCount <= 2 || leftCount == 9) return true;

        var indexes = [];
        var solvedCells = [];
        for (var li = 0, len = numberLeftCandidates.length; li < len; li++) {
            var target = numberLeftCandidates[li];
            if (solvedCells.indexOf([target.str]) != -1) {
                continue;
            }
            var bLen = bKeys.length;
            indexes = getAllZeroArray(bLen);
            var occupiedLines = new Array(bLen);
            var occupiedColumns = new Array(bLen);
            var pattern = new Array(bLen);
            var targetBkeyIndex = bKeys.indexOf(target.bi);
            occupiedLines[targetBkeyIndex] = target.i;
            occupiedColumns[targetBkeyIndex] = target.j;
            pattern[targetBkeyIndex] = target.str;
            var foundPattern = true;
            for (var bKeyIndex = 0; bKeyIndex < bLen; bKeyIndex++) {
                if (target.bi === bKeys[bKeyIndex]) continue;
                var foundCandidate = false;
                var leftCells = numberLeftBlocks[bKeyIndex];
                for (var len = leftCells.length; indexes[bKeyIndex] < len; indexes[bKeyIndex]++) {
                    var subTarget = leftCells[indexes[bKeyIndex]];
                    if (occupiedLines.indexOf(subTarget.i) === -1 &&
                        occupiedColumns.indexOf(subTarget.j) === -1) {
                        occupiedLines[bKeyIndex] = subTarget.i;
                        occupiedColumns[bKeyIndex] = subTarget.j;
                        pattern[bKeyIndex] = subTarget.str;
                        foundCandidate = true;
                        break;
                    }
                }
                if (foundCandidate) {
                    continue;
                } else {
                    if (bKeyIndex === 0 ||
                        (bKeyIndex === 1 && (indexes[0] + 1 >= numberLeftBlocks[0].length || target.bi === bKeys[0]))) {
                        foundPattern = false;
                        break;
                    }
                    indexes[bKeyIndex] = 0;
                    if (targetBkeyIndex !== bKeyIndex - 1) {
                        occupiedLines[bKeyIndex - 1] = undefined;
                        occupiedColumns[bKeyIndex - 1] = undefined;
                        pattern[bKeyIndex - 1] = undefined;
                    } else if (bKeyIndex > 1) {
                        occupiedLines[bKeyIndex - 2] = undefined;
                        occupiedColumns[bKeyIndex - 2] = undefined;
                        pattern[bKeyIndex - 2] = undefined;
                    }
                    if (target.bi === bKeys[bKeyIndex - 1]) bKeyIndex--;
                    bKeyIndex -= 2;
                    indexes[bKeyIndex + 1]++;
                }
            }

            if (foundPattern) {
                for (var idx = 0; idx < bLen; idx++) {
                    solvedCells.push([pattern[idx]]);
                }
            } else {
                var cndObj = target;
                var candidatesObj = leftCandidates[cndObj.str];
                if (!candidatesObj) continue;
                infomations.singleNumberPatternRemoveCount++;
                result.removeCount++;
                if (!deleteCandidate(leftCandidates, lines, columns, blocks, candidatesObj, num, result, countMemo)) return false;
            }
        }
        return true;
    };

    var getAllZeroArray = function (len) {
        var array = [];
        for (var i = 0; i < len; i++) {
            array.push(0);
        }
        return array;
    };

    var removeByChain = function (leftCandidates, lines, columns, blocks, result, countMemo) {
        var lcKeys = Object.keys(leftCandidates);
        var onKeysMemo = {};
        for (var lci = 0, lclen = lcKeys.length; lci < lclen; lci++) {
            var cndObj = leftCandidates[lcKeys[lci]];
            if (!cndObj) continue;
            if (cndObj.candidates.length != 2) continue;
            if (onKeysMemo[cndObj.str]) continue;
            var biValue = hashMemo[cndObj.candidates.hash];
            //console.log("first--------------");
            var first = getChainResult(leftCandidates, lines, columns, blocks, cndObj, biValue[0], biValue[1], countMemo);
            //console.log("second--------------");
            var second = getChainResult(leftCandidates, lines, columns, blocks, cndObj, biValue[1], biValue[0], countMemo);

            if (first.err && second.err) return false;
            var trueResult = null;
            if (first.err) {
                trueResult = second;
            } else if (second.err) {
                trueResult = first;
            }

            if (trueResult) {
                var trkeys = Object.keys(trueResult.onKeys);
                for (var trki, trklen = trkeys.length; trki < trklen; trki++) {
                    var trkey = trkeys[trki];
                    var cndObj = leftCandidates[trkey];
                    if (!cndObj) continue;
                    result.removeCount++;
                    if (!deleteAllCandedates(leftCandidates, lines, columns, blocks, cndObj, trueResult.onKeys[trkey], result, countMemo)) return false;
                }
                continue;
            }

            var overlappedNums = first.hash & second.hash;
            if (overlappedNums) {
                for (var ni = 0, nums = hashMemo[overlappedNums], nlen = nums.length; ni < nlen; ni++) {

                    var num = nums[ni];
                    var numRecords1 = first.numsRecords[num];
                    var numRecords2 = second.numsRecords[num];

                    if (
                        !deleteByChainResultCross(leftCandidates, lines, columns, blocks, num, numRecords1.lines, numRecords2.columns, lcCross, first.onKeys, second.onKeys, result, countMemo)
                        || !deleteByChainResultCross(leftCandidates, lines, columns, blocks, num, numRecords2.lines, numRecords1.columns, lcCross, first.onKeys, second.onKeys, result, countMemo)
                        || !deleteByChainResultCross(leftCandidates, lines, columns, blocks, num, numRecords1.blocks, numRecords2.lines, blCross, first.onKeys, second.onKeys, result, countMemo)
                        || !deleteByChainResultCross(leftCandidates, lines, columns, blocks, num, numRecords1.blocks, numRecords2.columns, bcCross, first.onKeys, second.onKeys, result, countMemo)
                        || !deleteByChainResultCross(leftCandidates, lines, columns, blocks, num, numRecords2.blocks, numRecords1.lines, blCross, first.onKeys, second.onKeys, result, countMemo)
                        || !deleteByChainResultCross(leftCandidates, lines, columns, blocks, num, numRecords2.blocks, numRecords1.columns, bcCross, first.onKeys, second.onKeys, result, countMemo)
                    ) return false;

                    if (
                        !deleteByChainResultSame(leftCandidates, lines, columns, blocks, lines, num, numRecords1.lines, numRecords2.lines, first.onKeysOrder[num].lines, second.onKeysOrder[num].lines, result, countMemo)
                        || !deleteByChainResultSame(leftCandidates, lines, columns, blocks, lines, num, numRecords1.lines, numRecords2.lines, first.onKeysOrder[num].columns, second.onKeysOrder[num].columns, result, countMemo)
                        || !deleteByChainResultSame(leftCandidates, lines, columns, blocks, lines, num, numRecords1.lines, numRecords2.lines, first.onKeysOrder[num].blocks, second.onKeysOrder[num].blocks, result, countMemo)
                    ) return false;

                }
                var fkeys = Object.keys(first.onKeys);
                var skeys = Object.keys(second.onKeys);
                for (var fi = 0, flen = fkeys.length; fi < flen; fi++) {
                    var fkey = fkeys[fi];
                    onKeysMemo[fkey] = true;
                    for (var si = 0, slen = skeys.length; si < slen; si++) {
                        var skey = skeys[si];
                        onKeysMemo[skey] = true;
                        if (fkey == skey && first.onKeys[fkey] == second.onKeys[skey]) {
                            var cndObj = leftCandidates[fkey];
                            if (!cndObj) continue;
                            result.removeCount++;
                            if (!deleteAllCandedates(leftCandidates, lines, columns, blocks, leftCandidates[fkey], first.onKeys[fkey], result, countMemo)) return false;
                        }
                    }
                }
            }
        }
        return true;
    };

    var getChainResult = function (leftCandidates, lines, columns, blocks, cndObj, onNum, offNum, countMemo) {
        var chainResult = {
            hash: 0,
            offNumKeys: {},
            onKeys: {},
            numsRecords: {},
            onKeysOrder: {},
            err: false
        };
        if (!addChainResultOn(leftCandidates, lines, columns, blocks, cndObj, onNum, countMemo, chainResult)) {
            chainResult.err = true;
            return chainResult;
        }
        if (!addChainResultOff(leftCandidates, lines, columns, blocks, cndObj, offNum, countMemo, chainResult)) {
            chainResult.err = true;
            return chainResult;
        }
        return chainResult;
    };

    var addChainResultOn = function (leftCandidates, lines, columns, blocks, cndObj, onNum, countMemo, chainResult) {
        if (!addChainResult(chainResult, cndObj, onNum)) return false;
        //console.log("on : " + cndObj.str + " : " + Math.log2(onNum * 2));
        var lkeys = Object.keys(cndObj.lefts);
        for (var li = 0, llen = lkeys.length; li < llen; li++) {
            var key = lkeys[li];
            var candidates = cndObj.lefts[key];
            if ((candidates.hash & onNum) && (!chainResult.onKeys[key])) {
                if (candidates.length == 2) {
                    if (!addChainResultOn(leftCandidates, lines, columns, blocks, leftCandidates[key], candidates.hash - onNum, countMemo, chainResult)) return false;
                } else {
                    if (!addChainResultOff(leftCandidates, lines, columns, blocks, leftCandidates[key], onNum, countMemo, chainResult)) return false;
                }
            }
        }
        return true;
    };

    var addChainResultOff = function (leftCandidates, lines, columns, blocks, cndObj, offNum, countMemo, chainResult, excludeGroup) {
        if (!chainResult.offNumKeys[cndObj.str]) {
            chainResult.offNumKeys[cndObj.str] = offNum
        } else {
            if ((chainResult.offNumKeys[cndObj.str] & offNum)) return true;
            chainResult.offNumKeys[cndObj.str] += offNum;
        }
        if (!(excludeGroup == "l"))
            if (!addChainResultOffGroups(leftCandidates, lines, columns, blocks, cndObj.line, cndObj.i, cndObj, offNum, countMemo, countMemo.numbersMemo.lines, chainResult, "l")) return false;
        if (!(excludeGroup == "c"))
            if (!addChainResultOffGroups(leftCandidates, lines, columns, blocks, cndObj.column, cndObj.j, cndObj, offNum, countMemo, countMemo.numbersMemo.columns, chainResult, "c")) return false;
        if (!(excludeGroup == "b"))
            if (!addChainResultOffGroups(leftCandidates, lines, columns, blocks, cndObj.block, cndObj.bi, cndObj, offNum, countMemo, countMemo.numbersMemo.blocks, chainResult, "b")) return false;
        return true;
    };

    var addChainResultOffGroups = function (leftCandidates, lines, columns, blocks, group, gkey, cndObj, offNum, countMemo, numbersMemoGroup, chainResult, groupName) {
        if (numbersMemoGroup[gkey][offNum] == 2) {
            var gkeys = Object.keys(group);
            for (var gi = 0, glen = gkeys.length; gi < glen; gi++) {
                var key = gkeys[gi];
                if (key === cndObj.str) continue;
                var candidates = group[key];
                if ((candidates.hash & offNum) && !chainResult.onKeys[key]) {
                    if (!addChainResultOn(leftCandidates, lines, columns, blocks, leftCandidates[key], offNum, countMemo, chainResult)) return false;
                    for (var offNums = hashMemo[candidates.hash - offNum], ofni = 0, ofnlen = offNums.length; ofni < ofnlen; ofni++) {
                        if (!addChainResultOff(leftCandidates, lines, columns, blocks, leftCandidates[key], offNums[ofni], countMemo, chainResult, groupName)) return false;
                    }
                    break;
                }
            }
        }
        return true;
    };

    var addChainResult = function (chainResult, cndObj, num) {
        chainResult.hash |= num;
        chainResult.onKeys[cndObj.str] = num;
        if (!chainResult.numsRecords[num]) chainResult.numsRecords[num] = { lines: [], columns: [], blocks: [] };
        if (!chainResult.onKeysOrder[num]) chainResult.onKeysOrder[num] = { lines: [], columns: [], blocks: [] };
        var numRecords = chainResult.numsRecords[num];
        var onKeysOrder = chainResult.onKeysOrder[num];
        if (numRecords.lines.indexOf(cndObj.i) != -1
            || numRecords.columns.indexOf(cndObj.j) != -1
            || numRecords.blocks.indexOf(cndObj.bi) != -1) {
            return false;
        }
        numRecords.lines.push(cndObj.i);
        numRecords.columns.push(cndObj.j);
        numRecords.blocks.push(cndObj.bi);
        onKeysOrder.lines.push(cndObj.str);
        onKeysOrder.columns.push(cndObj.str);
        onKeysOrder.blocks.push(cndObj.str);
        return true;
    };

    var deleteByChainResultCross = function (leftCandidates, lines, columns, blocks, num, g1, g2, crossMemo, onKeys1, onKeys2, result, countMemo) {
        for (var g1i = 0, g1len = g1.length; g1i < g1len; g1i++) {
            var i1 = g1[g1i];
            for (var g2i = 0, g2len = g2.length; g2i < g2len; g2i++) {
                var i2 = g2[g2i];
                var targetKeys = crossMemo[i1][i2];
                for (var tki = 0, tklen = targetKeys.length; tki < tklen; tki++) {
                    var targetKey = targetKeys[tki];
                    if ((onKeys1[targetKey] & num) || (onKeys2[targetKey] & num)) continue;
                    var targetCndObj = leftCandidates[targetKey];
                    if (targetCndObj && (targetCndObj.candidates.hash & num)) {
                        result.removeCount++;
                        if (!deleteCandidate(leftCandidates, lines, columns, blocks, targetCndObj, num, result, countMemo)) return false;
                    }
                }
            }
        }
        return true;
    };

    var deleteByChainResultSame = function (leftCandidates, lines, columns, blocks, groups, num, gs1, gs2, onKeysOrder1, onKeysOrder2, result, countMemo) {
        for (var gs1i = 0, gs1len = gs1.length; gs1i < gs1len; gs1i++) {
            var g1i = gs1[gs1i];
            for (var gs2i = 0, gs2len = gs2.length; gs2i < gs2len; gs2i++) {
                var g2i = gs2[gs2i];
                if (g1i != g2i) continue;
                var group = groups[g1i];
                var gkeys = Object.keys(group);
                for (var gi = 0, len = gkeys.length; gi < len; gi++) {
                    var key = gkeys[gi];
                    if (onKeysOrder1[gs1i] != key && onKeysOrder2[gs2i] != key) {
                        var cndObj = leftCandidates[key];
                        if (!cndObj) continue;
                        if (cndObj.candidates.hash & num) {
                            result.removeCount++;
                            if (!deleteCandidate(leftCandidates, lines, columns, blocks, cndObj, num, result, countMemo)) {
                                return false;
                            }
                        }
                    }
                }
            }
        }
        return true;
    };

    var validateMemoMap = function (memoMap) {
        var result = true;
        var lines = {};
        var columns = {};
        var blocks = {};
        iterateAllCell(function (str, i, j, bi) {
            var candidates = memoMap[str];
            if (candidates.length != 1) {
                result = false;
                return false;
            }
            var value = candidates.hash;
            if (!lines[i]) lines[i] = 0;
            if (lines[i] & value) {
                return result = false;
            }
            lines[i] += value;
            if (!columns[j]) columns[j] = 0;
            if (columns[i] & value) {
                return result = false;
            }
            columns[i] += value;
            if (!blocks[bi]) blocks[bi] = 0;
            if (blocks[i] & value) {
                return result = false;
            }
            blocks[i] += value;
            return true;
        });
        return result;
    };

    var validateQuestion = function (q) {
        var lines = new Array(CELL_LENGTH);
        var columns = new Array(CELL_LENGTH);
        var blocks = new Array(CELL_LENGTH);
        var result = true;
        iterateAllCell(function (str, i1, j1, bi) {
            var num;
            if (!(num = q[i1 - 1][j1 - 1])) return true;
            var line = lines[i1 - 1] ? lines[i1 - 1] : lines[i1 - 1] = [];
            var column = columns[j1 - 1] ? columns[j1 - 1] : columns[j1 - 1] = [];
            var block = blocks[bi - 1] ? blocks[bi - 1] : blocks[bi - 1] = [];
            if (line.indexOf(num) === -1 && column.indexOf(num) === -1 && block.indexOf(num) === -1) {
                line.push(num);
                column.push(num);
                block.push(num);
                return true;
            } else {
                return result = false;
            }
        });
        return result;
    };

    var createQuestionFromMemoMap = function (memoMap, oi1, oj1, candidate) {
        var q = [];
        for (var i = 0; i < CELL_LENGTH; i++) {
            q.push([]);
            for (var j = 0; j < CELL_LENGTH; j++) {
                q[i].push(0);
            }
        }
        for (var i = 1; i <= CELL_LENGTH; i++) {
            for (var j = 1; j <= CELL_LENGTH; j++) {
                var candidates = memoMap[i + "-" + j];
                if (candidates.length === 1) {
                    q[i - 1][j - 1] = candidates.hash;
                }
            }
        }

        var newMemoMap = copyMemoMap(memoMap);
        newMemoMap[oi1 + "-" + oj1] = { hash: candidate, length: 1, key: oi1 + "-" + oj1 };
        q[oi1 - 1][oj1 - 1] = candidate;
        return [q, newMemoMap];
    };

    var copyMemoMap = function (memoMap) {
        var newMemoMap = {};
        for (var i = 1; i <= CELL_LENGTH; i++) {
            for (var j = 1; j <= CELL_LENGTH; j++) {
                var str = i + "-" + j;
                newMemoMap[str] = { hash: memoMap[str].hash, length: memoMap[str].length, key: str };
            }
        }
        return newMemoMap;
    };

    var memoMapToAnswer = function (memoMap) {
        var answer = [];
        for (var i = 1; i <= CELL_LENGTH; i++) {
            var line = [];
            for (var j = 1; j <= CELL_LENGTH; j++) {
                line.push((Math.log2(memoMap[i + "-" + j].hash) + 1));
            }
            answer.push(line);
        }
        return answer;
    }

    var memoMapHashToArray = function (memoMap) {
        var memoMapArray = [];
        for (var i = 1; i <= CELL_LENGTH; i++) {
            var line = [];
            for (var j = 1; j <= CELL_LENGTH; j++) {
                line.push(hashMemoLog2[memoMap[i + "-" + j].hash].concat());
            }
            memoMapArray.push(line);
        }
        return memoMapArray;
    }

    if (exports) {
        exports.analizeSudoku = analizeSudoku;
        exports.validateQuestion = validateQuestion;
        exports.getInfomations = getInfomations;
        exports.clearInfomations = clearInfomations;
        exports.memoMapToAnswer = memoMapToAnswer;
        exports.memoMapHashToArray = memoMapHashToArray;
        exports.version = version;
        exports.iterateAllCell = iterateAllCell;
    }

    init();
})();

onmessage = function (e) {
    var questions = e.data;
    var results = [];
    for (var i = 0; i < questions.length; i++) {
        if (results.length == 100) {
            postMessage([results, false]);
            results = [];
        }
        var result = solver.analizeSudoku(questions[i]);
        result.answer = solver.memoMapToAnswer(result.memoMap);
        if (result.dup) {
            result.secondResult.answer = solver.memoMapToAnswer(result.secondResult.memoMap);
        }
        results.push(result);
    }
    postMessage([results, true]);
};



