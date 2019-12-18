var infomations = {
    callCount: 0,
    maxDepth: 1,
    loopCount: 0,
    decideCandidateRemoveCount: 0,
    findSingleNumberRemoveCount: 0,
    groupStraddleRemoveCount: 0,
    groupConstraintRemoveCount: 0,
    groupPatternsRemoveCount: 0,
    tempCount: 0,
    tempObjs: []
};
var clearInformations = function () {
    infomations = {
        callCount: 0,
        maxDepth: 1,
        loopCount: 0,
        decideCandidateRemoveCount: 0,
        findSingleNumberRemoveCount: 0,
        groupStraddleRemoveCount: 0,
        groupConstraintRemoveCount: 0,
        groupPatternsRemoveCount: 0,
        tempCount: 0,
        tempObjs: []
    };
};
var getInformations = function () {
    return infomations;
};

var CELL_LENGTH = 9

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
    const leftCandidates = {};

    const lines = {};
    const columns = {};
    const blocks = {};
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

    //問題の埋まっているセルに関しての処理
    iterateAllCell(function (str, i, j, bi) {
        if (q[i - 1][j - 1] && q[i - 1][j - 1] != "0") {
            var candidateObj = leftCandidates[str];
            deleteAllCandedates(leftCandidates, lines, columns, blocks, candidateObj, q[i - 1][j - 1], result, countMemo);
        }
        return true;
    });
    iterateAllCell(function (str, i, j, bi) {
        if (q[i - 1][j - 1] && q[i - 1][j - 1] != "0") {
            var candidateObj = leftCandidates[str];
            if (candidateObj) {
                if (!decideCandidates(leftCandidates, lines, columns, blocks, str, q[i - 1][j - 1], result, countMemo)) {
                    return false;
                }
            }
        }
        return true;
    });

    if (result.err) return endAsError(memoMap, leftCandidates, lines, columns, blocks);

    infomations.decideCandidateRemoveCount += result.removeCount;

    result.removeCount = 0;
    if (Object.keys(leftCandidates).length === 0) {
        solved = true;
    }
    while (!solved) {
        infomations.loopCount++;
        removeCount = 1;
        while (removeCount) {
            result = { err: false, removeCount: 0 };
            if (!findSingleNumber2(leftCandidates, lines, columns, blocks, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
            if (Object.keys(leftCandidates).length === 0) {
                solved = true;
                break;
            }
            infomations.findSingleNumberRemoveCount += result.removeCount;
            removeCount = result.removeCount;
        }
        if (solved) break;
        removeCount = 0;

        if (!removeByGroupStraddleConstraintAll(leftCandidates, lines, columns, blocks, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
        if (Object.keys(leftCandidates).length === 0) {
            solved = true;
            break;
        }

        if (!removeByGroupPatternsAll(leftCandidates, lines, columns, blocks, lines, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
        if (!removeByGroupPatternsAll(leftCandidates, lines, columns, blocks, columns, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
        if (!removeByGroupPatternsAll(leftCandidates, lines, columns, blocks, blocks, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
        if (Object.keys(leftCandidates).length === 0) {
            solved = true;
            break;
        }
        removeCount = result.removeCount;

        var bKeys = Object.keys(blocks);
        for (var idxb = 0, lenb = bKeys.length; idxb < lenb; idxb++) {
            if (!removeByBlockAndLineColumnPatterns(leftCandidates, lines, columns, blocks, blocks[bKeys[idxb]], bKeys[idxb], result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
        }
        if (removeCount == 0) break;
    }

    var leftKeys = Object.keys(leftCandidates);
    if (leftKeys.length === 0) {
        if (validateMemoMap(memoMap)) {
            return { result: true, dup: false, invalid: false, memoMap: memoMap, msg: "solved", countMemo: countMemo };
        } else {
            return { result: false, dup: false, invalid: true, memoMap: memoMap, msg: "no solution" };
        }
    } else {
        //------------------------------------------------------------------
        var firstResult = null;
        //候補が少ないマス目から埋めてみる戦略
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
                //return result;
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
    iterateAllCell(function (str, i, j) {
        memoMap[str] = getNewNumberMemo();
        return true;
    });
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

    //ここで残数確認する方法を試したいけど修正が面倒
    //if (Object.keys(candidatesObj).length == 1) {
    //    decideCandidates(leftCandidates, lines, columns, blocks, candidateObj.key, Object.keys(candidatesObj)[0], result, countMemo);
    //}
    //if (line[deleteNumber] == 1) {
    //    decideSingleNumberInList2(leftCandidates, lines, columns, blocks, lines[candidatesObj.i], deleteNumber, result, countMemo);
    //}
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
    countMemo.lines[candidatesObj.bi][decidedNumber] = false;
    countMemo.numbersMemo.lines[candidatesObj.i][decidedNumber]--;
    countMemo.numbersMemo.columns[candidatesObj.j][decidedNumber]--;
    countMemo.numbersMemo.blocks[candidatesObj.bi][decidedNumber]--;
    if (!removeCandidatesFromList(leftCandidates, lines, columns, blocks, candidatesObj.lefts, decidedNumber, key, result, countMemo)) return false;
    delete leftCandidates[key];


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
            if (lcKeys.length == 0) {
                result.err = true;
                return false;
            } else if (lcKeys.length == 1 && leftCandidates[lKeys[idx]]) {
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
            if (countMemo.numbersMemo.lines[groupIndex][num] == 1) {
                if (!decideSingleNumberInList2(leftCandidates, lines, columns, blocks, lines[groupIndex], num, result, countMemo)) return false;
            }
            if (countMemo.numbersMemo.columns[groupIndex][num] == 1) {
                if (!decideSingleNumberInList2(leftCandidates, lines, columns, blocks, columns[groupIndex], num, result, countMemo)) return false;
            }
            if (countMemo.numbersMemo.blocks[groupIndex][num] == 1) {
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
    console.log("number " + number + " not found");
    return false;
};

var removeByGroupStraddleConstraintAll = function (leftCandidates, lines, columns, blocks, result, countMemo) {
    if (
        !removeByGroupStraddleConstraint(leftCandidates, lines, columns, blocks, blocks, lines, "bi", result, countMemo.lines, countMemo)
        || !removeByGroupStraddleConstraint(leftCandidates, lines, columns, blocks, blocks, columns, "bi", result, countMemo.columns, countMemo)
        || !removeByGroupStraddleConstraint(leftCandidates, lines, columns, blocks, lines, blocks, "i", result, countMemo.blocks, countMemo)
        || !removeByGroupStraddleConstraint(leftCandidates, lines, columns, blocks, columns, blocks, "j", result, countMemo.blocks, countMemo)
    ) return false;
    return true;
};

var removeByGroupStraddleConstraint = function (leftCandidates, lines, columns, blocks, removeTargetLsts, lists, key, result, listsMemo, countMemo) {
    for (var num = 1; num <= CELL_LENGTH; num++) {
        var listKeys = Object.keys(lists);
        for (var idx1 = 0, len1 = listKeys.length; idx1 < len1; idx1++) {
            var listMemo = listsMemo[listKeys[idx1]];
            if (!listMemo[num]) continue;
            var biMemo = [];
            var targets = [];
            var continueFlag = false;
            var list = lists[listKeys[idx1]];
            var listKeys2 = Object.keys(list);
            for (var idx2 = 0, len2 = listKeys2.length; idx2 < len2; idx2++) {
                var candidatesObj = leftCandidates[listKeys2[idx2]];
                if (candidatesObj.candidates[num]) {
                    if (biMemo.indexOf(candidatesObj[key]) === -1) {
                        if (biMemo.length === 1) {
                            continueFlag = true;
                            break;
                        }
                        biMemo.push(candidatesObj[key]);
                    }
                    targets.push(candidatesObj);
                }
            }
            if (continueFlag) continue;
            if (targets.length > 0) {
                if (!removeNumFromGroup(leftCandidates, lines, columns, blocks, targets, num, removeTargetLsts[biMemo[0]], result, countMemo)) return false;
            }
        }
    }
    return true;
};

var removeNumFromGroup = function (leftCandidates, lines, columns, blocks, candidatesObjs, num, group, result, countMemo) {
    var cndKeys = Object.keys(candidatesObjs);
    var expKeyList = [];
    for (var idx1 = 0, len1 = cndKeys.length; idx1 < len1; idx1++) {
        var candidateObj = candidatesObjs[cndKeys[idx1]];
        expKeyList.push(candidateObj.str);
    }

    var cellKeys = Object.keys(group);

    for (var idx2 = 0, len2 = cellKeys.length; idx2 < len2; idx2++) {
        var key = cellKeys[idx2];
        if (expKeyList.indexOf(key) === -1) {
            var cell = group[key];
            if (cell && cell[num]) {
                infomations.groupStraddleRemoveCount++;
                delete cell[num];
                deleteCandidate(leftCandidates, lines, columns, blocks, leftCandidates[key], num, result, countMemo);
                result.removeCount++;
                var cellNums = Object.keys(cell);
                var cellNumsLength = cellNums.length;
                if (cellNumsLength === 0) {
                    result.err = true;
                    return false;
                } else if (cellNumsLength === 1) {
                    if (!decideCandidates(leftCandidates, lines, columns, blocks, key, cellNums[0], result, countMemo)) return false;
                }
            }
        }
    }
    return true;
};

var removeByGroupPatternsAll = function (leftCandidates, lines, columns, blocks, lists, result, countMemo) {
    var listKeys = Object.keys(lists);
    for (var idx = 0, len = listKeys.length; idx < len; idx++) {
        if (!removeByGroupPatterns2(leftCandidates, lines, columns, blocks, lists[listKeys[idx]], result, countMemo)) return false;
    }
    return true;
};

var removeByGroupPatterns2 = function (leftCandidates, lines, columns, blocks, group, result, countMemo) {
    var keys = Object.keys(group);
    var len1 = keys.length;
    if (len1 <= 1) return true;
    //if (len1 > 5) return true; //全空白の問題に対応できるため、長さで制限する必要なし(3*3の場合)

    var workList = [];
    var indexes = [];
    for (var idx1 = 0; idx1 < len1; idx1++) {
        var candidates = group[keys[idx1]];
        var nums = Object.keys(candidates);
        //if (nums.length == 0) return true;
        indexes.push(0);
        // 0 : key, 1 : candidates, 2 : nums, 3 : nums.length, 4 : memo
        workList.push([keys[idx1], candidates, nums, nums.length, []]);
    }

    var pointingIndex = 0;
    var pointingNumsIndex = 0;
    var removeList = [];
    while (true) {
        var pattern = new Array(len1);
        var pointingWork = workList[pointingIndex];
        var skipPointing = false;
        var breakFlag = false;
        while (true) {
            var pointingNum = pointingWork[2][pointingNumsIndex];
            if (pointingWork[4].indexOf(pointingNum) == -1) {
                pattern[pointingIndex] = pointingNum;
                break;
            } else {
                pointingNumsIndex++;
                indexes = getAllZeoArray(len1);
                if (pointingNumsIndex == pointingWork[3]) {
                    pointingNumsIndex = 0;
                    pointingIndex++;
                    skipPointing = true;
                    breakFlag = pointingIndex == len1;
                    break;
                }
            }
        }
        if (breakFlag) break;
        if (skipPointing) continue;

        var foundPattern = true;
        var foundNumber = true;
        for (var index = 0; index < len1; index++) {
            if (pointingIndex === index) {
                if (foundNumber) {
                    continue;
                } else {
                    index--;
                    if (index < 0) {
                        foundPattern = false;
                        break;
                    }
                }
            }
            var work = workList[index];

            foundNumber = false;
            for (var nums = work[2], len2 = work[3]; indexes[index] < len2; indexes[index]++) {
                var num = nums[indexes[index]];
                if (pattern.indexOf(num) == -1) {
                    pattern[index] = num;
                    foundNumber = true;
                    break;
                }
            }

            if (!foundNumber) {
                indexes[index] = 0;
                if (index == 0 || (pointingIndex == 0 && index == 1)) {
                    foundPattern = false;
                    break;
                }
                pattern[index] = undefined;
                if (index - 1 == pointingIndex) {
                    indexes[index - 2]++;
                } else {
                    indexes[index - 1]++;
                }
                index -= 2;
            }
        }
        if (foundPattern) {
            for (var index2 = 0; index2 < len1; index2++) {
                workList[index2][4].push(pattern[index2]);
            }
        } else {
            removeList.push([pointingWork, pointingNum]);
        }

        pointingNumsIndex++;
        indexes = getAllZeoArray(len1);
        if (pointingNumsIndex == pointingWork[3]) {
            pointingNumsIndex = 0;
            pointingIndex++;
            if (pointingIndex == len1) break;
        }
    }
    if (removeList.length) {
        for (var index3 = 0, len3 = removeList.length; index3 < len3; index3++) {
            var removeTuple = removeList[index3];
            var removeWork = removeTuple[0];
            var num = removeTuple[1];
            var candidates = removeWork[1];
            infomations.groupPatternsRemoveCount++;
            delete candidates[num];
            deleteCandidate(leftCandidates, lines, columns, blocks, leftCandidates[removeWork[0]], num, result, countMemo);
        }
        for (var index4 = 0; index4 < len1; index4++) {
            var candidates;
            if (!(candidates = group[keys[index4]])) continue;
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

var getAllZeoArray = function (length) {
    var array = [];
    for (var i = 0; i < length; i++) {
        array.push(0);
    }
    return array;
};

var removeByBlockAndLineColumnPatterns = function (leftCandidates, lines, columns, blocks, block, bi, result, countMemo) {
    var keys = Object.keys(block);
    var len1 = keys.length;
    if (len1 <= 1) return true;
    //if (len1 != 6) return true;

    var workList = [];
    var generaLGroup = [];
    var removeList = [];
    var lineCountMemo = {};
    var columnCountMemo = {};
    var noNeedLineCheck = true;
    var noNeedColumnCheck = true;
    for (var idx1 = 0; idx1 < len1; idx1++) {
        var candidates = block[keys[idx1]];
        var nums = Object.keys(candidates);
        generaLGroup.push(nums);
        var cndObj = leftCandidates[keys[idx1]];
        if (!lineCountMemo[cndObj.i]) lineCountMemo[cndObj.i] = 0;
        lineCountMemo[cndObj.i]++;
        if (lineCountMemo[cndObj.i] >= 2) noNeedLineCheck = false;
        if (!columnCountMemo[cndObj.j]) columnCountMemo[cndObj.j] = 0;
        columnCountMemo[cndObj.j]++;
        if (columnCountMemo[cndObj.j] >= 2) noNeedColumnCheck = false;
        // 0 : candidatesObj, 1 : candidates, 2 : nums, 3 : nums.length, 4 : memo
        workList.push([cndObj, candidates, nums, nums.length, []]);
    }

    if (noNeedLineCheck && noNeedColumnCheck) return true;

    var patternMemo = {};
    var linePatternMemo = {};
    var columnPatternMemo = {};
    for (var idx1 = 0; idx1 < len1; idx1++) {
        var nums = generaLGroup[idx1];
        for (var idx2 = 0, len2 = nums.length; idx2 < len2; idx2++) {
            var num = nums[idx2];
            var tempGroup = getRemovedNumGroupGeneral(generaLGroup, num);
            tempGroup[idx1] = [num];
            var foundCrossPattern = false;
            iterateGroupPatterns2(tempGroup, function (pattern) {
                var patternStr = pattern.join('');
                if (patternMemo[patternStr]) {
                    if (patternMemo[patternStr].result) {
                        foundCrossPattern = true;
                        return false;
                    } else {
                        return true;
                    }
                }
                //ここで関連するline,columnのパターンが存在できるか確認
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

                for (var i3 = 0, lKeys = Object.keys(lWork), len3 = lKeys.length; i3 < len3; i3++) {
                    var linePattern = lWork[lKeys[i3]];
                    if (linePattern.length <= 1) continue;
                    var lGroup = getRemovedNumGroup(leftCandidates, lines[lKeys[i3]], linePattern, bi);
                    if (!findGroupPattern2(lGroup)) {
                        patternMemo[patternStr] = { result: false };
                        return true;
                    }
                }

                for (var i4 = 0, cKeys = Object.keys(cWork), len4 = cKeys.length; i4 < len4; i4++) {
                    var columnPattern = cWork[cKeys[i4]];
                    if (columnPattern.length <= 1) continue;
                    var cGroup = getRemovedNumGroup(leftCandidates, columns[cKeys[i4]], columnPattern, bi);
                    if (!findGroupPattern2(cGroup)) {
                        patternMemo[patternStr] = { result: false };
                        return true;
                    }
                }
                patternMemo[patternStr] = { result: true };
                foundCrossPattern = true;
                return false;
            });
            if (!foundCrossPattern) {
                //console.log(infomations.callCount + "\t" + len1 + "\t" + keys[idx1] + "\t" + num);
                infomations.tempObjs.push(/*infomations.callCount + " " + len1 + " " + */keys[idx1] + " " + num);
                removeList.push([idx1, num]);
            }
        }
    }

    if (removeList.length) {
        for (var index3 = 0, len3 = removeList.length; index3 < len3; index3++) {
            var removeTuple = removeList[index3];
            var idx1 = removeTuple[0];
            var num = removeTuple[1];
            var candidates = block[keys[idx1]];
            //infomations.groupPatternsRemoveCount++;
            delete candidates[num];
            deleteCandidate(leftCandidates, lines, columns, blocks, leftCandidates[keys[idx1]], num, result, countMemo);
        }
        for (var index4 = 0; index4 < len1; index4++) {
            var candidates;
            if (!(candidates = block[keys[index4]])) continue;
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

var getRemovedNumGroup = function (leftCandidates, group, removedNumbers, removedBlockIndex) {
    var numsGroup = [];
    var keys = Object.keys(group);
    for (var idx1 = 0, len1 = keys.length; idx1 < len1; idx1++) {
        var cndObj = leftCandidates[keys[idx1]];
        if (cndObj.bi == removedBlockIndex) continue;
        var nums = Object.keys(cndObj.candidates);
        for (var idx2 = 0, len2 = removedNumbers.length; idx2 < len2; idx2++) {
            var index = nums.indexOf(removedNumbers[idx2]);
            if (index != -1) {
                nums.splice(index, 1);
            }
        }
        numsGroup.push(nums);
    }
    return numsGroup;
};

var iterateGroupPatterns = function (group, callBack) {
    var len = group.length;
    if (len == 0) return;
    for (var i = 0; i < len; i++) {
        var member = group[i];
        if (!member) {
            console.log(group);
        }
        if (member.length == 0) {
            return true;
        }
    }
    var firstMember = group[0];
    if (len == 1) {
        for (var i = 0, len = firstMember.length; i < len; i++) {
            var cont = callBack([firstMember[i]]);
            if (!cont) return false;
        }
        return true;
    }

    for (var i = 0, len = firstMember.length; i < len; i++) {
        var num = firstMember[i];
        var callBackResult = true;
        var subGroup = getRemovedNumGroupGeneral(group.slice(1), num);
        iterateGroupPatterns(subGroup, function (subGroupPattern) {
            var pattern = [num].concat(subGroupPattern);
            return callBackResult = callBack(pattern);
        });
        if (!callBackResult) {
            break;
        }
    }
    return true;
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
            if (indexes[pointingIndex] == pointingMember.length) {
                indexes[pointingIndex] = 0;
                pattern[pointingIndex] = undefined;
                pointingIndex--;
                if (pointingIndex < 0) return;
                continue;
            }
            indexes[pointingIndex]++;
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
    if (gLen == 0) return true;
    for (var i = 0; i < gLen; i++) {
        var member = group[i];
        if (member.length == 0) return false;
    }
    if (gLen == 1) return true;

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
        if (pattern.indexOf(num) == -1) {
            pattern.push(num);
            if (memberIndex + 1 == length) return true;
            if (findGroupPattern2Sub(group, length, pattern, memberIndex + 1)) return true;
        }
    }
    pattern.pop();
    return false;
};


var findGroupPattern = function (group) {
    var gLen = group.length;
    if (gLen == 0) return true;
    for (var i = 0; i < len; i++) {
        var member = group[i];
        if (member.length == 0) return false;
    }
    if (gLen == 1) return true;
    var firstMember = group[0];
    for (var i = 0, len = firstMember.length; i < len; i++) {
        var num = firstMember[i];
        var subGroup = getRemovedNumGroupGeneral(group.slice(1), num);
        if (findGroupPattern(subGroup)) return true;
    }
    return false;
};

var getRemovedNumGroupGeneral = function (group, num) {
    var newGroup = [];
    var len = group.length;
    for (var i = 0; i < len; i++) {
        var member = group[i];
        var index = member.indexOf(num);
        if (index != -1) {
            var temp1 = member.slice(0, index);
            var temp2 = member.slice(index + 1, member.length);
            member = temp1.concat(temp2);
        }
        newGroup.push(member);
    }
    return newGroup;
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
        var value = candidates[keys[0]];
        var line = lines[i] ? lines[i] : lines[i] = {};
        if (line[value]) return result = false;
        line[value] = true;
        var column = columns[j] ? columns[j] : columns[j] = {};
        if (column[value]) return result = false;
        column[value] = true;
        var block = blocks[bi] ? blocks[bi] : blocks[bi] = {};
        if (block[value]) return result = false;
        block[value] = true;
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
    iterateAllCell(function (str, i1, j1, bi) {
        var candidates = memoMap[str];
        var cndKeys = Object.keys(candidates);
        if (cndKeys.length === 1) {
            q[i1 - 1][j1 - 1] = cndKeys[0];
        }
        return true;
    });
    q[oi1 - 1][oj1 - 1] = candidate;

    var newMemoMap = copyMemoMap(memoMap);

    return [q, newMemoMap];
};

var copyMemoMap = function (memoMap) {
    var newMemoMap = {};
    iterateAllCell(function (str, i1, j1, bi) {
        newMemoMap[str] = {};
        var keys = Object.keys(memoMap[str]);
        for (var key in keys) {
            newMemoMap[str][keys[key]] = true;
        }
        return true;
    });
    return newMemoMap;
};

var exports = exports;
if (exports) {
    exports.solveSudoku = solveSudoku;
    exports.validateQuestion = validateQuestion;
    exports.getInformations = getInformations;
    exports.clearInformations = clearInformations;
}

//console.log(findGroupPattern2([["1", "6", "7"], ["6"], ["4", "6", "7"], ["6", "7", "9"]]));
//console.log(findGroupPattern2([["4", "6", "7"], ["6"], ["4", "6", "7"], ["6", "7", "9"]]));
//console.log(findGroupPattern2([["6", "7"], ["6"], ["4", "6", "7"], ["6", "7", "9"]]));
//console.log(findGroupPattern2([["6", "7"], ["6"], ["4", "6", "7"], ["6", "7", "4"]]));
/*
iterateGroupPatterns2([["1", "6", "7"], ["6"], ["4", "6", "7"], ["6", "7", "9"]], function(array){
    console.log(JSON.stringify(array));
    return true;
});
*/

//console.log(findGroupPattern2([["6"], ["4"]]));
//console.log(findGroupPattern2([["1", "7"], ["1", "2", "7"], ["3"], ["1", "3"]]));