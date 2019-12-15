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
    if (!memoMap) memoMap = getNewMemoMap();
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

    var removeCount = 1;
    var result = { err: false, removeCount: 0 };
    var solved = false;
    initQuestion(q, memoMap, leftCandidates, lines, columns, blocks, countMemo, depth);


    removeCount = 1;

    removeCount = 0;
    result = { err: false, removeCount: 0 };

    //問題の埋まっているセルに関しての処理
    iterateAllCell(function (str, i, j, bi) {
        if (q[i - 1][j - 1]) {
            var candidateObj = leftCandidates[str];
            deleteAllCandedates(candidateObj, q[i - 1][j - 1], countMemo);
        }
        return true;
    });
    iterateAllCell(function (str, i, j, bi) {
        if (q[i - 1][j - 1]) {
            var candidateObj = leftCandidates[str];
            if (candidateObj) {
                if (!decideCandidates(leftCandidates, str, q[i - 1][j - 1], result, countMemo)) {
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
            //if (!findSingleNumber(leftCandidates, lines, columns, blocks, lines, result, countMemo)
            //    || !findSingleNumber(leftCandidates, lines, columns, blocks, columns, result, countMemo)
            //    || !findSingleNumber(leftCandidates, lines, columns, blocks, blocks, result, countMemo)
            //) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
            if (Object.keys(leftCandidates).length === 0) {
                solved = true;
                break;
            }
            infomations.findSingleNumberRemoveCount += result.removeCount;
            removeCount = result.removeCount;
        }
        if (solved) break;
        //if (Object.keys(leftCandidates).length == 0) break;
        removeCount = 0;

        //removeByGroupPatternsAll -> removeByGroupPatterns2 がこれの上位互換かつ高速なので不要っぽい
        //if (!removeByGroupConstraintAll(leftCandidates, lines, columns, blocks, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
        //if (Object.keys(leftCandidates).length === 0) {
        //    solved = true;
        //    break;
        //}

        if (!removeByGroupStraddleConstraintAll(leftCandidates, lines, columns, blocks, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
        if (Object.keys(leftCandidates).length === 0) {
            solved = true;
            break;
        }

        if (!removeByGroupPatternsAll(leftCandidates, lines, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
        if (!removeByGroupPatternsAll(leftCandidates, columns, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
        if (!removeByGroupPatternsAll(leftCandidates, blocks, result, countMemo)) return endAsError(memoMap, leftCandidates, lines, columns, blocks);
        if (Object.keys(leftCandidates).length === 0) {
            solved = true;
            break;
        }
        removeCount = result.removeCount;
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
        var candidatesObj = leftCandidates[leftKeys[0]];
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

var initQuestion = function (q, memoMap, leftCandidates, lines, columns, blocks, countMemo, depth) {
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
            if (depth == 1) {
                linesNumbersMemo[listIndex][num] = CELL_LENGTH;
                columnsNumbersMemo[listIndex][num] = CELL_LENGTH;
                bloksNumbersMemo[listIndex][num] = CELL_LENGTH;
            } else {
                linesNumbersMemo[listIndex][num] = 0;
                columnsNumbersMemo[listIndex][num] = 0;
                bloksNumbersMemo[listIndex][num] = 0;
            }
        }

    }

    if (depth > 1) {
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

var deleteAllCandedates = function (candidatesObj, decidedNumber, countMemo) {
    var candidates = candidatesObj.candidates;
    for (var idx = 1; idx <= CELL_LENGTH; idx++) {
        if (candidates[idx] && decidedNumber != idx) {
            delete candidates[idx];
            deleteCandidate(candidatesObj, idx, countMemo);
        }
    }
};

var deleteCandidate = function (candidatesObj, deleteNumber, countMemo) {
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

var findSingleCandidateAll = function (leftCandidates, lines, columns, blocks, result, countMemo) {
    var keys = Object.keys(leftCandidates);
    for (var idx = 0, len = keys.length; idx < len; idx++) {
        var key = keys[idx];
        var candidatesObj = leftCandidates[key];
        if (!candidatesObj) continue;
        var cndKeys = Object.keys(candidatesObj.candidates);
        if (cndKeys.length == 1) {
            if (!decideCandidates(leftCandidates, key, cndKeys[0], result, countMemo)) return false;
        }
    }
    return true;
};


var decideCandidates = function (leftCandidates, key, decidedNumber, result, countMemo) {
    var candidatesObj = leftCandidates[key];
    if (!removeCandidatesFromList(leftCandidates, candidatesObj.lefts, decidedNumber, key, result, countMemo)) return false;
    delete leftCandidates[key];
    delete candidatesObj.line[key];
    delete candidatesObj.column[key];
    delete candidatesObj.block[key];
    countMemo.lines[candidatesObj.i][decidedNumber] = false;
    countMemo.columns[candidatesObj.j][decidedNumber] = false;
    countMemo.lines[candidatesObj.bi][decidedNumber] = false;
    countMemo.numbersMemo.lines[candidatesObj.i][decidedNumber]--;
    countMemo.numbersMemo.columns[candidatesObj.j][decidedNumber]--;
    countMemo.numbersMemo.blocks[candidatesObj.bi][decidedNumber]--;
    return true;
};

var removeCandidatesFromList = function (leftCandidates, list, decidedNumber, key, result, countMemo) {
    var lKeys = Object.keys(list);

    for (var idx = 0, len = lKeys.length; idx < len; idx++) {
        var lCandidates = list[lKeys[idx]];
        if (lCandidates[decidedNumber]) {
            var candidatesObj = leftCandidates[lKeys[idx]];
            if (!candidatesObj) continue;
            delete lCandidates[decidedNumber];
            deleteCandidate(candidatesObj, decidedNumber, countMemo);
            var lcKeys = Object.keys(lCandidates);
            if (lcKeys.length == 0) {
                result.err = true;
                return false;
            } else if (lcKeys.length == 1 && leftCandidates[lKeys[idx]]) {
                if (!decideCandidates(leftCandidates, lKeys[idx], lcKeys[0], result, countMemo)) return false;
            }
            result.removeCount++;
        }
    }
    return true;
}

var findSingleNumber = function (leftCandidates, lines, columns, blocks, lists, result, countMemo) {
    var listKeys = Object.keys(lists);
    for (var idx = 0, len = listKeys.length; idx < len; idx++) {
        if (!findSingleNumberInList(leftCandidates, lines, columns, blocks, lists[listKeys[idx]], result, countMemo)) return false;
    }
    return true;
};

var findSingleNumberInList = function (leftCandidates, lines, columns, blocks, list, result, countMemo) {
    var singleNumberMemo = new Array(CELL_LENGTH + 1);
    var listKeys = Object.keys(list);
    for (var idx1 = 0, len1 = listKeys.length; idx1 < len1; idx1++) {
        var key = listKeys[idx1];
        var candidates = list[key];
        var candidatesKeys = Object.keys(candidates);
        for (var idx2 = 0, len2 = candidatesKeys.length; idx2 < len2; idx2++) {
            var candidate = candidatesKeys[idx2];
            if (!singleNumberMemo[candidate]) {
                singleNumberMemo[candidate] = []
            }
            singleNumberMemo[candidate].push(key);
        }
    }

    for (var idx3 = 1, len3 = singleNumberMemo.length; idx3 < len3; idx3++) {
        var candidate = idx3;
        var memo = singleNumberMemo[candidate];
        if (memo && memo.length == 1 && list[memo[0]]) {
            var candidates = list[memo[0]];
            deleteAllCandedates(leftCandidates[memo[0]], candidate, countMemo);
            if (!decideCandidates(leftCandidates, memo[0], candidate, result, countMemo)) return false;
        }
    }
    return true;
};

var findSingleNumber2 = function (leftCandidates, lines, columns, blocks, result, countMemo) {
    for (var groupIndex = 1; groupIndex <= CELL_LENGTH; groupIndex++) {
        for (var num = 1; num <= CELL_LENGTH; num++) {
            if (countMemo.numbersMemo.lines[groupIndex][num] == 1) {
                if (!decideSingleNumberInList2(leftCandidates, lines[groupIndex], num, result, countMemo)) return false;
            }
            if (countMemo.numbersMemo.columns[groupIndex][num] == 1) {
                if (!decideSingleNumberInList2(leftCandidates, columns[groupIndex], num, result, countMemo)) return false;
            }
            if (countMemo.numbersMemo.blocks[groupIndex][num] == 1) {
                if (!decideSingleNumberInList2(leftCandidates, blocks[groupIndex], num, result, countMemo)) return false;
            }
        }
    }
    return true;
};

var decideSingleNumberInList2 = function (leftCandidates, list, number, result, countMemo) {
    var listKeys = Object.keys(list);
    for (var idx = 0, len = listKeys.length; idx < len; idx++) {
        var key = listKeys[idx];
        if (list[key][number]) {
            deleteAllCandedates(leftCandidates[key], number, countMemo);
            if (!decideCandidates(leftCandidates, key, number, result, countMemo)) return false;
            return true;
        }
    }
    console.log("number " + number + " not found");
    return false;
};

var removeByGroupStraddleConstraintAll = function (leftCandidates, lines, columns, blocks, result, countMemo) {
    if (
        !removeByGroupStraddleConstraint(leftCandidates, blocks, lines, "bi", result, countMemo.lines, countMemo)
        || !removeByGroupStraddleConstraint(leftCandidates, blocks, columns, "bi", result, countMemo.columns, countMemo)
        || !removeByGroupStraddleConstraint(leftCandidates, lines, blocks, "i", result, countMemo.blocks, countMemo)
        || !removeByGroupStraddleConstraint(leftCandidates, columns, blocks, "j", result, countMemo.blocks, countMemo)
    ) return false;
    return true;
};

var removeByGroupStraddleConstraint = function (leftCandidates, removeTargetLsts, lists, key, result, listsMemo, countMemo) {
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
                if (!removeNumFromGroup(leftCandidates, targets, num, removeTargetLsts[biMemo[0]], result, countMemo)) return false;
            }
        }
    }
    return true;
};

var removeNumFromGroup = function (leftCandidates, candidatesObjs, num, group, result, countMemo) {
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
                deleteCandidate(leftCandidates[key], num, countMemo);
                result.removeCount++;
                var cellNums = Object.keys(cell);
                var cellNumsLength = cellNums.length;
                if (cellNumsLength === 0) {
                    result.err = true;
                    return false;
                } else if (cellNumsLength === 1) {
                    if (!decideCandidates(leftCandidates, key, cellNums[0], result, countMemo)) return false;
                }
            }
        }
    }
    return true;
};

var removeByGroupConstraintAll = function (leftCandidates, lines, columns, blocks, result, countMemo) {
    if (!applyFunctionGroups(removeByGroupConstraint, leftCandidates, lines, result, countMemo)) return false;
    if (!applyFunctionGroups(removeByGroupConstraint, leftCandidates, columns, result, countMemo)) return false;
    if (!applyFunctionGroups(removeByGroupConstraint, leftCandidates, blocks, result, countMemo)) return false;
    return true;
};

var applyFunctionGroups = function (func, leftCandidates, groups, result, countMemo) {
    var keys = Object.keys(groups);
    for (var idx = 0, len = keys.length; idx < len; idx++) {
        if (!func(leftCandidates, groups[keys[idx]], result, countMemo)) return false;
    }
    return true;
};

var removeByGroupConstraint = function (leftCandidates, group, result, countMemo) {
    var keys = Object.keys(group);
    var length = keys.length;
    if (length <= 2) return true;
    for (var num = 2; num <= length - 1; num++) {
        var targets = [];
        for (var key in keys) {
            var item = group[keys[key]];
            if (!item) continue;
            var itemKeys = Object.keys(item);
            if (itemKeys.length > num) continue;
            targets.push(item);
        }
        var valiation = getGroupValiation(targets, num);

        for (var idx1 = 0, len1 = valiation.length; idx1 < len1; idx1++) {
            var breakFlag = false;
            var numberMemo = [];
            var subGroup = valiation[idx1];
            for (var idx2 = 0, len2 = subGroup.length; idx2 < len2; idx2++) {
                var item = subGroup[idx2];
                if (!item) continue;
                var itemKeys = Object.keys(item);
                for (var idx3 = 0, len3 = itemKeys.length; idx3 < len3; idx3++) {
                    var number = itemKeys[idx3];
                    if (numberMemo.indexOf(number) == -1) {
                        numberMemo.push(number);
                        if (numberMemo.length > num) {
                            breakFlag = true;
                            break;
                        }
                    }
                }
                if (breakFlag) break;
            }
            if (breakFlag) {
                continue;
            } else {
                for (var idx4 = 0, len4 = keys.length; idx4 < len4; idx4++) {
                    var item = group[keys[idx4]];
                    if (!item) continue;
                    if (subGroup.indexOf(item) === -1) {
                        for (var idx5 = 0, len5 = numberMemo.length; idx5 < len5; idx5++) {
                            number = numberMemo[idx5];
                            if (item[number]) {
                                result.removeCount++;
                                infomations.groupConstraintRemoveCount++;
                                delete item[number];
                            }
                        }

                        var itemNums = Object.keys(item);
                        var itemNumsLength = itemNums.length;
                        if (itemNumsLength === 0) {
                            result.err = true;
                            return false;
                        } else if (itemNumsLength === 1) {
                            if (!decideCandidates(leftCandidates, keys[idx4], itemNums[0], result, countMemo)) return false;
                        }
                    }
                }
            }
        }
    }
    return true;
};

var getGroupValiation = function (group, num) {
    var result = [];
    var groupLength = group.length;
    var groupLengthM1 = groupLength - 1;
    if (groupLength < num || num < 1) return result;
    if (num === 1) return getGroupValiationSingle(group);
    var indexes = [];
    var indexIndex = 0;
    for (var i = 0; i < num; i++) {
        indexes.push(i);
    }

    while (true) {
        indexIndex = 0;
        var groupValiation = [];
        for (var index = 0, len = indexes.length; index < len; index++) {
            groupValiation.push(group[indexes[index]]);
        }
        result.push(groupValiation);

        do {
            if (indexes[indexIndex] + 1 === indexes[indexIndex + 1]) {
                indexIndex++;
                if (indexes[indexIndex] === groupLengthM1) {
                    return result;
                } else {
                    continue;
                }
            } else {
                indexes[indexIndex]++;
                break;
            }
        } while (true)
    }
};

var getGroupValiationSingle = function (group) {
    var result = [];
    for (var key in group) {
        result.push([group[key]]);
    }
    return result;
};

var removeByGroupPatternsAll = function (leftCandidates, lists, result, countMemo) {
    var listKeys = Object.keys(lists);

    for (var idx = 0, len = listKeys.length; idx < len; idx++) {
        if (!removeByGroupPatterns2(leftCandidates, lists[listKeys[idx]], result, countMemo)) return false;
        //if (!removeByGroupPatterns(leftCandidates, lists[listKeys[idx]], result, countMemo)) return false;
    }
    return true;
};

//単一グループのパターン網羅で候補削除（旧バージョン）
var removeByGroupPatterns = function (leftCandidates, group, result, countMemo) {
    var keys = Object.keys(group);
    if (keys.length > 5) return true; //残り空白マスが多すぎると計算量が膨大になるためスキップ
    var Patterns = [];
    var candidatesCount = 0;
    for (var idx1 = 0, len1 = keys.length; idx1 < len1; idx1++) {
        var idx1p1 = idx1 + 1;
        var candidates = group[keys[idx1]];
        var keys2 = Object.keys(candidates);
        //if (keys2.length == 0) return true;
        var newPatterns = [];
        for (var idx2 = 0, len2 = keys2.length; idx2 < len2; idx2++) {
            candidatesCount++;
            var num = keys2[idx2];
            if (idx1 === 0) {
                newPatterns.push([num]);
            } else {
                for (var idx3 = 0, len3 = Patterns.length; idx3 < len3; idx3++) {
                    var Pattern = Patterns[idx3];
                    if (Pattern.indexOf(num) === -1) {
                        var newPattern = Pattern.slice(0, idx1p1);
                        newPattern.push(num);
                        newPatterns.push(newPattern);
                    }
                }
            }
        }
        Patterns = newPatterns;
    }

    var memo = {};
    for (var idx1 = 0; idx1 < len1; idx1++) {
        memo[idx1] = {};
    }

    var newCandidatesCount = 0;
    for (var idx4 = 0, len4 = Patterns.length; idx4 < len4; idx4++) {
        var Pattern = Patterns[idx4];
        for (var idx5 = 0; idx5 < len1; idx5++) {
            if (!memo[idx5][Pattern[idx5]]) {
                memo[idx5][Pattern[idx5]] = true;
                newCandidatesCount++;
            }
        }
        if (newCandidatesCount == candidatesCount) return true;
    }

    if (newCandidatesCount < candidatesCount) {
        //console.log(candidatesCount - newCandidatesCount);
        infomations.tempCount += candidatesCount - newCandidatesCount;
        var diffCount = candidatesCount - newCandidatesCount;
        for (var idx1 = 0, len1 = keys.length; idx1 < len1; idx1++) {
            var newCandidates = memo[idx1];
            var candidates = group[keys[idx1]];
            if (!candidates) continue;
            var keys2 = Object.keys(candidates);
            for (var idx2 = 0, len2 = keys2.length; idx2 < len2; idx2++) {
                if (!newCandidates[keys2[idx2]]) {
                    infomations.groupPatternsRemoveCount++;
                    delete candidates[keys2[idx2]];
                    deleteCandidate(leftCandidates[keys[idx1]], keys2[idx2], countMemo);
                    diffCount--;
                    result.removeCount++;
                    if (diffCount === 0) break;
                }
            }
            keys2 = Object.keys(candidates);
            len2 = keys2.length;
            if (len2 === 0) {
                result.err = true;
                return false;
            } else if (len2 === 1) {
                if (!decideCandidates(leftCandidates, keys[idx1], keys2[0], result, countMemo)) return false;
            }
            if (diffCount === 0) break;
        }
    }
    return true;
};


var removeByGroupPatterns2 = function (leftCandidates, group, result, countMemo) {
    var keys = Object.keys(group);
    var len1 = keys.length;
    if (len1 <= 1) return true;
    //if (len1 > 5) return true; 全空白の問題に対応できるため、長さで制限する必要なし(3*3の場合)

    var workList = [];
    var indexes = [];
    for (var idx1 = 0; idx1 < len1; idx1++) {
        var candidates = group[keys[idx1]];
        var nums = Object.keys(candidates);
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
                indexes = [];
                for (var index = 0; index < len1; index++) {
                    indexes.push(0);
                }
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
        indexes = [];
        for (var index = 0; index < len1; index++) {
            indexes.push(0);
        }
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
            var candidates = removeWork[1]
            delete candidates[num];
            deleteCandidate(leftCandidates[removeWork[0]], num, countMemo);
        }
        for (var index4 = 0; index4 < len1; index4++) {
            var candidates;
            if (!(candidates = group[keys[index4]])) continue;
            var cKeys = Object.keys(candidates);
            if (cKeys.length == 0) {
                result.err = true;
                return false;
            } else if (cKeys.length == 1) {
                if (!decideCandidates(leftCandidates, keys[index4], cKeys[0], result, countMemo)) return false;
            }
        }
    }
    return true;
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