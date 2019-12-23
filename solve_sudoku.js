var exports = exports;
if (!exports) exports = {};
var solver = exports;
var version = "1.1.2";
(function () {
    var infomations = {
        callCount: 0,
        maxDepth: 1,
        loopCount: 0,
        decideCandidateRemoveCount: 0,
        findSingleNumberRemoveCount: 0,
        blockAndLineColumnPatternsRemoveCount: 0,
        singleNumberPatternRemoveCount: 0
    };
    var clearInfomations = function () {
        infomations = {
            callCount: 0,
            maxDepth: 1,
            loopCount: 0,
            decideCandidateRemoveCount: 0,
            findSingleNumberRemoveCount: 0,
            blockAndLineColumnPatternsRemoveCount: 0,
            singleNumberPatternRemoveCount: 0
        };
    };
    var getInfomations = function () {
        return infomations;
    };

    var CELL_LENGTH = 9;

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
                if (q[i - 1][j - 1] && q[i - 1][j - 1] != "0") {
                    var candidateObj = leftCandidates[str];
                    deleteAllCandedates(leftCandidates, lines, columns, blocks, candidateObj, q[i - 1][j - 1], result, countMemo);
                }
            }
        }

        for (var i = 1; i <= CELL_LENGTH; i++) {
            for (var j = 1; j <= CELL_LENGTH; j++) {
                var str = i + "-" + j;
                if (q[i - 1][j - 1] && q[i - 1][j - 1] != "0") {
                    var candidateObj = leftCandidates[str];
                    if (candidateObj) {
                        if (!decideCandidates(leftCandidates, lines, columns, blocks, str, q[i - 1][j - 1], result, countMemo)) {
                            return endAsError(memoMap, leftCandidates, lines, columns, blocks);
                        }
                    }
                }
            }
        }

        infomations.decideCandidateRemoveCount += result.removeCount;

        result.removeCount = 0;
        if (Object.keys(leftCandidates).length === 0) {
            solved = true;
        }

        var looped = false;
        while (!solved) {
            infomations.loopCount++;
            removeCount = 0;
            var scanCount = 0;
            do {
                result = { err: false, removeCount: 0 };
                if (!findSingleNumber2(leftCandidates, lines, columns, blocks, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
                if (Object.keys(leftCandidates).length === 0) {
                    solved = true;
                    break;
                }
                infomations.findSingleNumberRemoveCount += result.removeCount;
                removeCount = result.removeCount;
                scanCount++;

            } while (removeCount);
            if (scanCount == 1 && looped) break;
            if (solved) break;
            removeCount = 0;

            if (removeBySingleNumberPatternAll(leftCandidates, lines, columns, blocks, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
            removeCount += result.removeCount;

            if (Object.keys(leftCandidates).length === 0) {
                solved = true;
                break;
            }

            if (Object.keys(leftCandidates).length >= 70) break;
            var bKeys = Object.keys(blocks);
            for (var idxb = 0, lenb = bKeys.length; idxb < lenb; idxb++) {
                if (!removeByBlockAndLineColumnPatterns(leftCandidates, lines, columns, blocks, blocks[bKeys[idxb]], bKeys[idxb], result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
            }

            if (Object.keys(leftCandidates).length === 0) {
                solved = true;
                break;
            }
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
                var num = Object.keys(candidatesObj.candidates).length;
                if (num < minNum) {
                    minNum = num;
                    minNumObj = candidatesObj;
                    if (num == 2) break;
                }
            }
            candidatesObj = minNumObj;
            var cndKeys = Object.keys(candidatesObj.candidates);
            var firstResult = null;
            for (var len = cndKeys.length, idx = len - 1; idx >= 0; idx--) {
                var candidate = cndKeys[idx];
                var q1 = createQuestionFromMemoMap(memoMap, candidatesObj.i, candidatesObj.j, candidate);
                var beforeBranchMemoMap = copyMemoMap(memoMap);
                var result = solveSudoku(q1[0], depth + 1, checkDupSol, q1[1]);

                if (result.result) {
                    result.beforeBranchMemoMap = beforeBranchMemoMap;
                    if (result.secondResult) {
                        return result;
                    }
                    if (firstResult) {
                        firstResult.secondResult = result;
                        firstResult.dup = true;
                        firstResult.msg = "not single solution";
                        firstResult.temporaryPlacement = {
                            i: candidatesObj.i,
                            j: candidatesObj.j,
                            candidate: candidate
                        };
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
            linesNumbersMemo[listIndex] = {};
            columnsNumbersMemo[listIndex] = {};
            bloksNumbersMemo[listIndex] = {};

            for (var num = 1; num <= CELL_LENGTH; num++) {
                linesNumbersMemo[listIndex][num] = CELL_LENGTH;
                columnsNumbersMemo[listIndex][num] = CELL_LENGTH;
                bloksNumbersMemo[listIndex][num] = CELL_LENGTH;
                if (useMemoMap) {
                    linesNumbersMemo[listIndex][num] = 0;
                    columnsNumbersMemo[listIndex][num] = 0;
                    bloksNumbersMemo[listIndex][num] = 0;
                } else {
                    linesNumbersMemo[listIndex][num] = CELL_LENGTH;
                    columnsNumbersMemo[listIndex][num] = CELL_LENGTH;
                    bloksNumbersMemo[listIndex][num] = CELL_LENGTH;
                }
            }

        }

        if (useMemoMap) {
            iterateAllCell(function (str, i, j, bi) {
                var memo = memoMap[str];
                for (var num = 1; num <= CELL_LENGTH; num++) {
                    if (memo[num]) {
                        linesNumbersMemo[i][num]++;
                        columnsNumbersMemo[j][num]++;
                        bloksNumbersMemo[bi][num]++;
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

            leftCandidates[str] = {
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

            if (!linesMemoMap[i]) linesMemoMap[i] = [];
            linesMemoMap[i].push(leftCandidates[str]);
            if (!columnsMemoMap[j]) columnsMemoMap[j] = [];
            columnsMemoMap[j].push(leftCandidates[str]);
            if (!blocksMemoMap[bi]) blocksMemoMap[bi] = [];
            blocksMemoMap[bi].push(leftCandidates[str]);
            return true;
        });

        iterateAllCell(function (str, i, j, bi) {
            var candidateObj = leftCandidates[str];
            var candidates = candidateObj.candidates;
            for (var idx1 = 0, line = linesMemoMap[i], len1 = line.length; idx1 < len1; idx1++) line[idx1].lefts[str] = candidates;
            for (var idx2 = 0, colmn = columnsMemoMap[j], len2 = colmn.length; idx2 < len2; idx2++) colmn[idx2].lefts[str] = candidates;
            for (var idx3 = 0, block = blocksMemoMap[bi], len3 = block.length; idx3 < len3; idx3++) block[idx3].lefts[str] = candidates;
            delete candidateObj.lefts[str];
            return true;
        });
    };

    var getNewMemoMap = function () {
        var memoMap = {};
        for (var i = 1; i <= CELL_LENGTH; i++) {
            for (var j = 1; j <= CELL_LENGTH; j++) {
                memoMap[i + "-" + j] = getNewNumberMemo();
            }
        }
        return memoMap;
    };

    var getNewNumberMemo = function () {
        return { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true };
    };

    var deleteAllCandedates = function (leftCandidates, lines, columns, blocks, candidatesObj, decidedNumber, result, countMemo) {
        var candidates = candidatesObj.candidates;
        for (var idx = 1; idx <= CELL_LENGTH; idx++) {
            if (candidates[idx] && decidedNumber != idx) {
                delete candidates[idx];
                deleteCandidate(leftCandidates, lines, columns, blocks, candidatesObj, idx, result, countMemo);
            }
        }
    };

    var deleteCandidate = function (leftCandidates, lines, columns, blocks, candidatesObj, deleteNumber, result, countMemo) {
        var line = countMemo.numbersMemo.lines[candidatesObj.i];
        line[deleteNumber]--;
        var column = countMemo.numbersMemo.columns[candidatesObj.j];
        column[deleteNumber]--;
        var block = countMemo.numbersMemo.blocks[candidatesObj.bi];
        block[deleteNumber]--;
    };

    var iterateAllCell = function (func) {
        for (var i = 1; i <= CELL_LENGTH; i++)
            for (var j = 1; j <= CELL_LENGTH; j++)
                if (!func(i + "-" + j, i, j, Math.floor((j - 1) / 3) + Math.floor((i - 1) / 3) * 3 + 1)) return false;
        return true;
    };

    var endAsError = function (memoMap, leftCandidates, lines, columns, blocks) {
        eliminateCrossReference(leftCandidates, lines, columns, blocks);
        return { result: false, dup: false, invalid: true, memoMap: memoMap, err: true, msg: "no solution" };
    };

    var eliminateCrossReference = function (leftCandidates, lines, columns, blocks) {
        var keys = Object.keys(leftCandidates);
        for (var key in keys) {
            var candidateObj = leftCandidates[keys[key]];
            deleteAllMembers(candidateObj);
        }
        deleteAllMembers(leftCandidates);
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
        if (!removeCandidatesFromList(leftCandidates, lines, columns, blocks, candidatesObj.lefts, decidedNumber, key, result, countMemo)) return false;

        return true;
    };

    var removeCandidatesFromList = function (leftCandidates, lines, columns, blocks, list, decidedNumber, key, result, countMemo) {
        var lKeys = Object.keys(list);
        for (var idx = 0, len = lKeys.length; idx < len; idx++) {
            var lCandidates = list[lKeys[idx]];
            if (lCandidates[decidedNumber]) {
                var candidatesObj = leftCandidates[lKeys[idx]];
                if (!candidatesObj) continue;
                delete lCandidates[decidedNumber];
                deleteCandidate(leftCandidates, lines, columns, blocks, candidatesObj, decidedNumber, result, countMemo);
                candidatesObj = leftCandidates[lKeys[idx]];
                if (!candidatesObj) continue;
                var lcKeys = Object.keys(lCandidates);
                if (lcKeys.length === 0) {
                    result.err = true;
                    return false;
                } else if (lcKeys.length === 1) {
                    if (!decideCandidates(leftCandidates, lines, columns, blocks, lKeys[idx], lcKeys[0], result, countMemo)) return false;
                }
                result.removeCount++;
            }
        }
        return true;
    };

    var findSingleNumber2 = function (leftCandidates, lines, columns, blocks, result, countMemo) {
        for (var groupIndex = 1; groupIndex <= CELL_LENGTH; groupIndex++) {
            for (var num = 1; num <= CELL_LENGTH; num++) {
                if (countMemo.lines[groupIndex][num] && countMemo.numbersMemo.lines[groupIndex][num] == 1) {
                    if (!decideSingleNumberInList2(leftCandidates, lines, columns, blocks, lines[groupIndex], num, result, countMemo)) return false;
                }
                if (countMemo.columns[groupIndex][num] && countMemo.numbersMemo.columns[groupIndex][num] == 1) {
                    if (!decideSingleNumberInList2(leftCandidates, lines, columns, blocks, columns[groupIndex], num, result, countMemo)) return false;
                }
                if (countMemo.blocks[groupIndex][num] && countMemo.numbersMemo.blocks[groupIndex][num] == 1) {
                    if (!decideSingleNumberInList2(leftCandidates, lines, columns, blocks, blocks[groupIndex], num, result, countMemo)) return false;
                }
            }
        }
        return true;
    };

    var decideSingleNumberInList2 = function (leftCandidates, lines, columns, blocks, list, number, result, countMemo) {
        var listKeys = Object.keys(list);
        for (var idx = 0, len = listKeys.length; idx < len; idx++) {
            var key = listKeys[idx];
            if (list[key][number]) {
                deleteAllCandedates(leftCandidates, lines, columns, blocks, leftCandidates[key], number, result, countMemo);
                if (!decideCandidates(leftCandidates, lines, columns, blocks, key, number, result, countMemo)) return false;
                return true;
            }
        }
        return false;
    };

    var removeByBlockAndLineColumnPatterns = function (leftCandidates, lines, columns, blocks, block, bi, result, countMemo) {
        var keys = Object.keys(block);
        var len1 = keys.length;
        if (len1 <= 1) return true;

        var workList = [];
        var generaLGroup = [];
        var removeList = [];
        var lineCountMemo = {};
        var columnCountMemo = {};
        var noNeedLineCheck = true;
        var noNeedColumnCheck = true;
        var linePatternMemo = {};
        var columnPatternMemo = {};
        var solvedNumberMemo = [];
        for (var idx1 = 0; idx1 < len1; idx1++) {
            var candidates = block[keys[idx1]];
            var nums = Object.keys(candidates);
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
            solvedNumberMemo.push([]);
            workList.push([cndObj, candidates, nums, nums.length, []]);
        }

        if (noNeedLineCheck && noNeedColumnCheck) return true;
        var lKeys = Object.keys(lineCountMemo);
        var cKeys = Object.keys(columnCountMemo);
        var patternMemo = {};

        var linesGeneral = {};
        var columnsGeneral = {};
        for (var li = 0, len = lKeys.length; li < len; li++) {
            linesGeneral[lKeys[li]] = getGeneralNumGroupRemovedBlock(leftCandidates, lines[lKeys[li]], bi);
        }
        for (var ci = 0, len = cKeys.length; ci < len; ci++) {
            columnsGeneral[cKeys[ci]] = getGeneralNumGroupRemovedBlock(leftCandidates, columns[cKeys[ci]], bi);
        }

        for (var idx1 = 0; idx1 < len1; idx1++) {
            var nums = generaLGroup[idx1];
            for (var idx2 = 0; idx2 < nums.length; idx2++) {
                var num = nums[idx2];
                var tempGroup = getRemovedNumGroupGeneral(generaLGroup, num);
                tempGroup[idx1] = [num];
                if (solvedNumberMemo[idx1].indexOf(num) != -1) continue;
                var foundCrossPattern = false;
                iterateGroupPatterns2(tempGroup, function (pattern) {
                    var patternStr = "";
                    for (var pi = 0; pi < len1; pi++) {
                        patternStr += pattern[pi];
                    }
                    if (patternMemo[patternStr]) {
                        if (patternMemo[patternStr].result) {
                            foundCrossPattern = true;
                            return false;
                        } else {
                            return true;
                        }
                    }

                    var lWork = {};
                    var cWork = {};
                    for (var index2 = 0; index2 < len1; index2++) {
                        var work = workList[index2];
                        var cndObj = work[0];
                        var linePattern = lWork[cndObj.i] ? lWork[cndObj.i] : lWork[cndObj.i] = [];
                        var columnPattern = cWork[cndObj.j] ? cWork[cndObj.j] : cWork[cndObj.j] = [];
                        linePattern.push(pattern[index2]);
                        columnPattern.push(pattern[index2]);
                    }

                    for (var i3 = 0, len3 = lKeys.length; i3 < len3; i3++) {
                        var lKey = lKeys[i3];
                        var linePattern = lWork[lKey];
                        var hash = getArrayHash(linePattern);
                        if (linePatternMemo[lKey][hash]) {
                            if (linePatternMemo[lKey][hash].result) continue;
                            else return true;
                        }
                        var lGroup = getRemovedNumsGroupGeneral(linesGeneral[lKey], linePattern);
                        if (!findGroupPattern2(lGroup)) {
                            linePatternMemo[lKey][hash] = { result: false };
                            patternMemo[patternStr] = { result: false };
                            return true;
                        } else {
                            linePatternMemo[lKey][hash] = { result: true };
                        }
                    }

                    for (var i4 = 0, len4 = cKeys.length; i4 < len4; i4++) {
                        var cKey = cKeys[i4];
                        var columnPattern = cWork[cKey];
                        var hash = getArrayHash(columnPattern);
                        if (columnPatternMemo[cKey][hash]) {
                            if (columnPatternMemo[cKey][hash].result) continue;
                            else return true;
                        }

                        var cGroup = getRemovedNumsGroupGeneral(columnsGeneral[cKey], columnPattern);
                        if (!findGroupPattern2(cGroup)) {
                            columnPatternMemo[cKey][hash] = { result: false };
                            patternMemo[patternStr] = { result: false };
                            return true;
                        } else {
                            columnPatternMemo[cKey][hash] = { result: true };
                        }
                    }

                    for (var pi = 0; pi < len1; pi++) {
                        solvedNumberMemo[pi].push(pattern[pi]);
                    }

                    patternMemo[patternStr] = { result: true };
                    foundCrossPattern = true;
                    return false;
                });
                if (!foundCrossPattern) {
                    removeList.push([idx1, num]);
                    var index = nums.indexOf(num);
                    nums.splice(index, 1);
                    idx2--;
                }
            }
        }

        if (removeList.length) {
            for (var index3 = 0, len3 = removeList.length; index3 < len3; index3++) {
                var removeTuple = removeList[index3];
                var idx1 = removeTuple[0];
                var num = removeTuple[1];
                var candidates = block[keys[idx1]];
                infomations.blockAndLineColumnPatternsRemoveCount++;
                if (!candidates) continue;
                delete candidates[num];
                result.removeCount++;
                deleteCandidate(leftCandidates, lines, columns, blocks, leftCandidates[keys[idx1]], num, result, countMemo);
            }
            for (var index4 = 0; index4 < len1; index4++) {
                var candidates;
                if (!(candidates = block[keys[index4]])) continue;
                if (!leftCandidates[keys[index4]]) continue;
                var cKeys = Object.keys(candidates);
                if (cKeys.length == 0) {
                    result.err = true;
                    return false;
                } else if (cKeys.length == 1) {
                    if (!decideCandidates(leftCandidates, lines, columns, blocks, keys[index4], cKeys[0], result, countMemo)) return false;
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
            var nums = Object.keys(cndObj.candidates);
            numsGroup.push(nums);
        }
        return numsGroup;
    };

    var iterateGroupPatterns2 = function (group, callBack) {
        var gLen = group.length;
        var indexes = [];

        for (var i = 0; i < gLen; i++) {
            var member = group[i];
            if (member.length == 0) {
                return;
            }
            indexes.push(0);
        }

        var doIncliment = false;
        var pointingIndex = 0;
        var pattern = new Array(gLen);
        while (true) {
            var pointingMember = group[pointingIndex];
            if (doIncliment) {
                indexes[pointingIndex]++;
                if (indexes[pointingIndex] == pointingMember.length) {
                    indexes[pointingIndex] = 0;
                    pattern[pointingIndex] = undefined;
                    pointingIndex--;
                    if (pointingIndex < 0) return;
                    doIncliment = true;
                    continue;
                }
            } else {
                if (indexes[pointingIndex] == pointingMember.length) {
                    return;
                }
            }
            doIncliment = true;

            var pointingNum = pointingMember[indexes[pointingIndex]];
            if (pattern.indexOf(pointingNum) == -1) {
                pattern[pointingIndex] = pointingNum;
                if (pointingIndex + 1 == gLen) {
                    var doContinue = callBack(pattern);
                    if (!doContinue) return;
                    pattern[pointingIndex] = undefined;
                    continue;
                } else {
                    doIncliment = false;
                    pointingIndex++;
                }
            }
        }
    };

    var findGroupPattern2 = function (group) {
        var gLen = group.length;
        if (gLen === 0) return true;
        for (var i = 0; i < gLen; i++) {
            var member = group[i];
            if (member.length === 0) return false;
        }
        if (gLen === 1) return true;

        var firstMember = group[0];
        for (var i = 0, len = firstMember.length; i < len; i++) {
            var num = firstMember[i];
            var pattern = [];
            pattern.push(num);
            if (findGroupPattern2Sub(group, gLen, pattern, 1)) return true;
        }
        return false;
    };

    var findGroupPattern2Sub = function (group, length, pattern, memberIndex) {
        var pointingMember = group[memberIndex];
        for (var i = 0, len = pointingMember.length; i < len; i++) {
            var num = pointingMember[i];
            if (pattern.indexOf(num) === -1) {
                pattern.push(num);
                if (memberIndex + 1 === length) return true;
                if (findGroupPattern2Sub(group, length, pattern, memberIndex + 1)) return true;
            }
        }
        pattern.pop();
        return false;
    };

    var getRemovedNumGroupGeneral = function (group, num) {
        var newGroup = [];
        var len = group.length;
        for (var i = 0; i < len; i++) {
            var member = group[i];
            var index = member.indexOf(num);
            if (index !== -1) {
                var newMember = [];
                for (var j = 0, len2 = member.length; j < len2; j++) {
                    if (j !== index) newMember.push(member[j]);
                }
                member = newMember;
            }
            newGroup.push(member);
        }
        return newGroup;
    };

    var getRemovedNumsGroupGeneral = function (group, nums) {
        var newGroup = [];
        var nLen = nums.length;
        var len = group.length;
        for (var i = 0; i < len; i++) {
            var member = group[i];
            for (var ni = 0; ni < nLen; ni++) {
                var num = nums[ni];
                var index = member.indexOf(num);
                if (index !== -1) {
                    var newMember = [];
                    for (var j = 0, len2 = member.length; j < len2; j++) {
                        if (j !== index) newMember.push(member[j]);
                    }
                    member = newMember;
                }
            }
            newGroup.push(member);
        }
        return newGroup;
    };

    var removeBySingleNumberPatternAll = function (leftCandidates, lines, columns, blocks, result, countMemo) {
        for (var num = 1; num <= CELL_LENGTH; num++) {
            if (removeBySingleNumberPattern(leftCandidates, lines, columns, blocks, num, result, countMemo)) return false;
        }
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
                    if (cnd.candidates[num]) {
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
        var removeList = [];
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
                    if (occupiedLines.indexOf(subTarget.i) == -1 &&
                        occupiedColumns.indexOf(subTarget.j) == -1) {
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
                removeList.push(target);
            }
        }

        if (removeList.length) {
            for (var idx1 = 0, len1 = removeList.length; idx1 < len1; idx1++) {
                infomations.singleNumberPatternRemoveCount++;
                result.removeCount++;
                var cndObj = removeList[idx1];
                var candidates = cndObj.candidates;
                if (!leftCandidates[cndObj.str]) continue;
                delete candidates[num];
                deleteCandidate(leftCandidates, lines, columns, blocks, cndObj, num, result, countMemo);
                var lcKeys = Object.keys(candidates);
                if (lcKeys.length == 0) {
                    result.err = true;
                    return false;
                } else if (lcKeys.length == 1) {
                    if (!decideCandidates(leftCandidates, lines, columns, blocks, cndObj.str, lcKeys[0], result, countMemo)) return false;
                }
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

    var getArrayHash = function (array) {
        var hash = 0;
        for (var i = 0, len = array.length; i < len; i++) {
            hash += 1 << (parseInt(array[i]) - 1);
        }
        return hash;
    };

    var deleteAllMembers = function (obj) {
        var keys = Object.keys(obj);
        for (var idx = 0, len = keys.length; idx < len; idx++) {
            delete obj[keys[idx]];
        }
    };

    var validateMemoMap = function (memoMap) {
        var result = true;
        var lines = {};
        var columns = {};
        var blocks = {};
        iterateAllCell(function (str, i, j, bi) {
            var candidates = memoMap[str];
            var keys = Object.keys(candidates);
            if (keys.length != 1) {
                result = false;
                return false;
            }
            var value = keys[0];
            var line = lines[i] ? lines[i] : lines[i] = {};
            if (line[value]) {
                return result = false;
            }
            line[value] = true;
            var column = columns[j] ? columns[j] : columns[j] = {};
            if (column[value]) {
                return result = false;
            }
            column[value] = true;
            var block = blocks[bi] ? blocks[bi] : blocks[bi] = {};
            if (block[value]) {
                return result = false;
            }
            block[value] = true;
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
                q[i].push("");
            }
        }
        for (var i = 1; i <= CELL_LENGTH; i++) {
            for (var j = 1; j <= CELL_LENGTH; j++) {
                var candidates = memoMap[i + "-" + j];
                var cndKeys = Object.keys(candidates);
                if (cndKeys.length === 1) {
                    q[i - 1][j - 1] = cndKeys[0];
                }
            }
        }
        q[oi1 - 1][oj1 - 1] = candidate;

        var newMemoMap = copyMemoMap(memoMap);

        return [q, newMemoMap];
    };

    var copyMemoMap = function (memoMap) {
        var newMemoMap = {};
        for (var i = 1; i <= CELL_LENGTH; i++) {
            for (var j = 1; j <= CELL_LENGTH; j++) {
                var str = i + "-" + j;
                newMemoMap[str] = {};
                var keys = Object.keys(memoMap[str]);
                for (var key in keys) {
                    newMemoMap[str][keys[key]] = true;
                }
            }
        }
        return newMemoMap;
    };

    var memoMapToAnswer = function (memoMap) {
        var answer = [];
        for (var i = 1; i <= CELL_LENGTH; i++) {
            var line = [];
            for (var j = 1; j <= CELL_LENGTH; j++) {
                line.push(Object.keys(memoMap[i + "-" + j])[0]);
            }
            answer.push(line);
        }
        return answer;
    }

    if (exports) {
        exports.solveSudoku = solveSudoku;
        exports.validateQuestion = validateQuestion;
        exports.getInfomations = getInfomations;
        exports.clearInfomations = clearInfomations;
        exports.memoMapToAnswer = memoMapToAnswer;
        exports.version = version;
    }
})();

onmessage = function (e) {
    var questions = e.data;
    var results = [];
    for (var i = 0; i < questions.length; i++) {
        if (results.length == 100) {
            postMessage([results, false]);
            results = [];
        }
        var result = solver.solveSudoku(questions[i], 1, true);
        result.answer = solver.memoMapToAnswer(result.memoMap);
        if(result.dup) {
            result.secondResult.answer = solver.memoMapToAnswer(result.secondResult.memoMap);
        }
        results.push(result);
    }
    postMessage([results, true]);
};
