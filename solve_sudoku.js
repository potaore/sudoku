var exports = exports;
if (!exports) exports = {};
var solver = exports;
(function () {
    var version = "1.3.3";
    var CELL_LENGTH = 9;

    var hashMemo = [], hashMemoLog2 = [], hashLengthMemo = [];
    var lcCross = {}, blCross = {}, bcCross = {}, allCells, cellNames;
    var warmupq;
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

        warmupq = [];
        cellNames = [];
        for (var i = 1; i <= CELL_LENGTH; i++) {
            lcCross[i] = {};
            blCross[i] = {};
            bcCross[i] = {};
            var cellNameLine = [];
            var warmupLine = [];
            for (var j = 1; j <= CELL_LENGTH; j++) {
                var cellName = i + "-" + j;
                cellNameLine.push(cellName)
                lcCross[i][j] = [cellName];
                blCross[i][j] = [];
                bcCross[i][j] = [];
                warmupLine.push(0);
            }
            cellNames.push(cellNameLine);
            warmupq.push(warmupLine);
        }

        allCells = [];
        for (var i = 1; i <= CELL_LENGTH; i++) {
            for (var j = 1; j <= CELL_LENGTH; j++) {
                var bi = Math.floor((j - 1) / 3) + Math.floor((i - 1) / 3) * 3 + 1;
                var cellName = cellNames[i - 1][j - 1];
                var cell = { str: cellName, i: i, j: j, bi, bi };
                allCells.push(cell);
                blCross[bi][i].push(cellName);
                bcCross[bi][j].push(cellName);
            }
        }
    };

    var warmup = function () {
        for (var i = 0; i < 10; i++) analizeSudoku(warmupq);
    };

    var infomations = {
        callCount: 0,
        maxDepth: 1,
        decideCandidateRemoveCount: 0,
        blockAndLineColumnPatternsRemoveCount: 0,
        singleNumberPatternRemoveCount: 0,
        chainRemoveCount: 0
    };

    var clearInfomations = function () {
        infomations = {
            callCount: 0,
            maxDepth: 1,
            decideCandidateRemoveCount: 0,
            blockAndLineColumnPatternsRemoveCount: 0,
            singleNumberPatternRemoveCount: 0,
            chainRemoveCount: 0
        };
    };

    var getInfomations = function () {
        return infomations;
    };

    var analizeSudoku = function (q) {
        if (!validateQuestion(q)) return { result: false, dup: false, invalid: true, memoMap: getNewMemoMap(), msg: "ninvalid question", countMemo: null };
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

        var $g = {
            leftCount: CELL_LENGTH * CELL_LENGTH,
            leftCells: {},
            lines: {},
            columns: {},
            blocks: {},
            countMemo: {
                lines: {}, columns: {}, blocks: {},
                numsMemo: { lines: {}, columns: {}, blocks: {} }
            },
            chainReserveQueue: []
        };

        var removeCount = 0;
        var result = { err: false, removeCount: 0 };
        var solved = false;
        initQuestion(q, memoMap, $g, useMemoMap);

        result = { err: false, removeCount: 0 };
        for (var i = 0; i < CELL_LENGTH; i++) {
            for (var j = 0; j < CELL_LENGTH; j++) {
                var str = cellNames[i][j];
                if (q[i][j]) {
                    var cellObj = $g.leftCells[str];
                    if (!cellObj) continue;
                    deleteAllCandedatesInitQ($g, cellObj, q[i][j]);
                }
            }
        }

        for (var i = 0; i < CELL_LENGTH; i++) {
            for (var j = 0; j < CELL_LENGTH; j++) {
                if (q[i][j]) {
                    var cellObj = $g.leftCells[cellNames[i][j]];
                    if (cellObj) {
                        if (!decideCandidates($g, cellObj.str, q[i][j], result)) return endAsError(memoMap);
                    }
                }
            }
        }

        infomations.decideCandidateRemoveCount += result.removeCount;
        if ($g.leftCount === 0) solved = true;

        var looped = false;
        while (!solved) {
            if ($g.leftCount >= 75) break;
            removeCount = 0;
            result.removeCount = 0;

            if (!removeBySingleNumberPatternAll($g, result)) return endAsError(memoMap);
            removeCount += result.removeCount;

            if ($g.leftCount === 0) {
                solved = true;
                break;
            }
            if (looped) break;
            removeCount = 0;
            result.removeCount = 0;
            if ($g.leftCount >= 65) break;

            for (var idxb = 1; idxb < CELL_LENGTH; idxb++) {
                if (!removeByBlockAndLineColumnPatterns($g, $g.blocks[idxb], idxb, result)) return endAsError(memoMap);
            }
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }
            removeCount += result.removeCount;

            result.removeCount = 0;
            if (!removeByChain($g, result)) return false;
            removeCount += result.removeCount;
            if (removeCount == 0) break;

            if ($g.leftCount === 0) {
                solved = true;
                break;
            }
            looped = true;
        }

        var leftKeys = Object.keys($g.leftCells);
        if (leftKeys.length === 0) {
            if (validateMemoMap(memoMap)) {
                return { result: true, dup: false, invalid: false, memoMap: memoMap, msg: "solved", countMemo: $g.countMemo };
            } else {
                return { result: false, dup: false, invalid: true, memoMap: memoMap, msg: "no solution", countMemo: $g.countMemo };
            }
        } else {
            var useDoubleTemporary = false;
            if (55 <= $g.leftCount && $g.leftCount <= 64) {
                var leftCount = 0;
                var nlist = hashMemo[511];
                for (var ii = 1; ii <= 9; ii++)
                    for (var jj = 0; jj < 9; jj++)
                        leftCount += $g.countMemo.numsMemo.lines[ii][nlist[jj]];
                useDoubleTemporary = leftCount >= 250;
            }

            var patterns = [];
            var minNum = 100;
            var cellObj = null;
            if (useDoubleTemporary) {
                var minNumObj1 = null;
                var minNumObj2 = null;
                for (var leftIdx = 0; leftIdx < leftKeys.length; leftIdx++) {
                    cellObj = $g.leftCells[leftKeys[leftIdx]];
                    if (!minNumObj1) {
                        minNumObj1 = cellObj;
                        continue;
                    }
                    var num = cellObj.candidates.length;
                    if (num < minNum) {
                        minNum = num;
                        minNumObj2 = minNumObj1;
                        minNumObj1 = cellObj;
                    } else if (num == minNum) {
                        minNumObj2 = cellObj;
                    }
                }

                var nums1 = hashMemo[minNumObj1.candidates.hash];
                var nums2 = hashMemo[minNumObj2.candidates.hash];
                for (var ni1 = 0, nlen1 = nums1.length; ni1 < nlen1; ni1++)
                    for (var ni2 = 0, nlen2 = nums2.length; ni2 < nlen2; ni2++)
                        patterns.push([
                            { i: minNumObj1.i, j: minNumObj1.j, num: nums1[ni1] },
                            { i: minNumObj2.i, j: minNumObj2.j, num: nums2[ni2] },
                        ]);
            } else {
                var minNumObj = null;
                for (var leftIdx = 0; leftIdx < leftKeys.length; leftIdx++) {
                    cellObj = $g.leftCells[leftKeys[leftIdx]];
                    var num = cellObj.candidates.length;
                    if (num < minNum) {
                        minNum = num;
                        minNumObj = cellObj;
                        if (num == 2) break;
                    }
                }
                var nums = hashMemo[minNumObj.candidates.hash];
                for (var ni = 0, nlen = nums.length; ni < nlen; ni++)
                    patterns.push([{ i: minNumObj.i, j: minNumObj.j, num: nums[ni] }]);
            }

            var firstResult = null;
            for (var pslen = patterns.length, idx = pslen - 1; idx >= 0; idx--) {
                var pattern = patterns[idx];
                var q1 = q;
                var memoMap1 = memoMap;
                for (var pi = 0, plen = pattern.length; pi < plen; pi++) {
                    var temporary = pattern[pi];
                    var newQ = createQuestionFromMemoMap(memoMap1, temporary.i, temporary.j, temporary.num);
                    q1 = newQ[0];
                    memoMap1 = newQ[1];
                }
                if (useDoubleTemporary) {
                    if (!validateQuestion(q1)) continue;
                }
                var result = solveSudoku(q1, depth + 1, checkDupSol, memoMap1);

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
        return { result: false, dup: false, invalid: true, memoMap: memoMap, msg: "no solution", countMemo: $g.countMemo };
    };

    var initQuestion = function (q, memoMap, $g, useMemoMap) {
        var linesNumsMemo = {};
        var columnsNumsMemo = {};
        var bloksNumsMemo = {};

        for (var listIndex = 1; listIndex <= CELL_LENGTH; listIndex++) {
            var lineMemo = linesNumsMemo[listIndex] = {};
            var columnMemo = columnsNumsMemo[listIndex] = {};
            var blockMemo = bloksNumsMemo[listIndex] = {};

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
                        linesNumsMemo[i][hash]++;
                        columnsNumsMemo[j][hash]++;
                        bloksNumsMemo[bi][hash]++;
                    }
                }
                return true;
            });
        }

        $g.countMemo.numsMemo = { lines: linesNumsMemo, columns: columnsNumsMemo, blocks: bloksNumsMemo };
        for (var num1 = 1; num1 <= CELL_LENGTH; num1++) {
            $g.lines[num1] = [];
            $g.columns[num1] = [];
            $g.blocks[num1] = [];
            $g.countMemo.lines[num1] = getNewNumberMemo();
            $g.countMemo.columns[num1] = getNewNumberMemo();
            $g.countMemo.blocks[num1] = getNewNumberMemo();
        }

        iterateAllCell(function (str, i, j, bi) {
            var candidates = memoMap[str];
            $g.lines[i].push(candidates);
            $g.columns[j].push(candidates);
            $g.blocks[bi].push(candidates);

            $g.leftCells[str] = {
                str: str,
                i: i,
                j: j,
                bi: bi,
                candidates: memoMap[str],
                line: $g.lines[i],
                column: $g.columns[j],
                block: $g.blocks[bi],
                lefts: []
            };
            return true;
        });

        iterateAllCell(function (str, i, j) {
            var cellObj = $g.leftCells[str];
            for (var li = 0, llen = cellObj.line.length; li < llen; li++) {
                var candidates = cellObj.line[li];
                if (candidates.key !== str) cellObj.lefts.push(candidates);
            }
            for (var ci = 0, clen = cellObj.column.length; ci < clen; ci++) {
                var candidates = cellObj.column[ci];
                if (candidates.key !== str) cellObj.lefts.push(candidates);
            }
            for (var bi = 0, blen = cellObj.block.length; bi < blen; bi++) {
                var candidates = cellObj.block[bi];
                if (candidates.key !== str) {
                    var cellObj2 = $g.leftCells[candidates.key];
                    if (cellObj2.i != i && cellObj2.j != j) cellObj.lefts.push(candidates);
                }
            }
            return true;
        });
    };

    var getNewMemoMap = function () {
        var memoMap = {};
        for (var i = 0; i < CELL_LENGTH; i++) {
            for (var j = 0; j < CELL_LENGTH; j++) {
                var cellName = cellNames[i][j];
                memoMap[cellName] = { hash: 511, length: 9, key: cellName };
            }
        }
        return memoMap;
    };

    var getNewNumberMemo = function () {
        return { 1: true, 2: true, 4: true, 8: true, 16: true, 32: true, 64: true, 128: true, 256: true };
    };

    var deleteAllCandedatesInitQ = function ($g, cellObj, decidedNumber) {
        var delHash = cellObj.candidates.hash - decidedNumber;
        var dellNums = hashMemo[delHash];
        if (!dellNums) {
            console.log("");
        }
        for (var dellNums = hashMemo[delHash], i = 0, len = dellNums.length; i < len; i++) {
            deleteCandidateInitQ($g, cellObj, dellNums[i]);
        }
    };

    var deleteCandidateInitQ = function ($g, cellObj, deleteNumber) {
        cellObj.candidates.hash -= deleteNumber;
        cellObj.candidates.length--;
        $g.countMemo.numsMemo.lines[cellObj.i][deleteNumber]--;
        $g.countMemo.numsMemo.columns[cellObj.j][deleteNumber]--;
        $g.countMemo.numsMemo.blocks[cellObj.bi][deleteNumber]--;
    };

    var deleteAllCandedates = function ($g, cellObj, decidedNumber, result) {
        var candidates = cellObj.candidates;
        candidates = hashMemo[candidates.hash];
        var len = candidates.length;
        if (len == 1) {
            if (!decideCandidates($g, cellObj.str, decidedNumber, result)) {
                return false;
            } else {
                return true;
            }
        }
        for (var idx = 0; idx < len; idx++) {
            var num = candidates[idx];
            if ((cellObj.candidates.hash & num) && decidedNumber != num) {
                if (!$g.leftCells[cellObj.str]) break;
                if (!deleteCandidate($g, cellObj, num, result)) {
                    return false;
                }
            }
        }
        return true;
    };

    var deleteCandidate = function ($g, cellObj, deleteNumber, result) {
        var candidates = cellObj.candidates;
        candidates.hash -= deleteNumber;
        candidates.length--;
        var line = $g.countMemo.numsMemo.lines[cellObj.i];
        line[deleteNumber]--;
        var column = $g.countMemo.numsMemo.columns[cellObj.j];
        column[deleteNumber]--;
        var block = $g.countMemo.numsMemo.blocks[cellObj.bi];
        block[deleteNumber]--;

        if (line[deleteNumber] == 0 || column[deleteNumber] == 0 || block[deleteNumber] == 0) {
            return false;
        }

        if (candidates.hash === 0) return !(result.err = true);

        if (candidates.length === 1)
            if (!decideCandidates($g, cellObj.str, candidates.hash, result)) {
                return false;
            }

        if ($g.countMemo.lines[cellObj.i][deleteNumber] && line[deleteNumber] == 1) {
            if (!decideSingleNumberInList($g, cellObj.line, deleteNumber, result)) {
                return false;
            }
        }
        if ($g.countMemo.columns[cellObj.j][deleteNumber] && column[deleteNumber] == 1) {
            if (!decideSingleNumberInList($g, cellObj.column, deleteNumber, result)) {
                return false;
            }
        }
        if ($g.countMemo.blocks[cellObj.bi][deleteNumber] && block[deleteNumber] == 1) {
            if (!decideSingleNumberInList($g, cellObj.block, deleteNumber, result)) {
                return false;
            }
        }
        if (candidates.length == 2) $g.chainReserveQueue.push(candidates);
        return true;
    };

    var iterateAllCell = function (func) {
        for (var i = 0, len = allCells.length; i < len; i++) {
            var cell = allCells[i];
            if (!func(cell.str, cell.i, cell.j, cell.bi)) return false;
        }
        return true;
    };

    var endAsError = function (memoMap) {
        return { result: false, dup: false, invalid: true, msg: "no solution", memoMap: memoMap, err: true };
    };

    var decideCandidates = function ($g, key, decidedNumber, result) {
        $g.leftCount--;
        var cellObj = $g.leftCells[key];
        var li = cellObj.line.indexOf(cellObj.candidates);
        cellObj.line.splice(li, 1);
        var ci = cellObj.column.indexOf(cellObj.candidates);
        cellObj.column.splice(ci, 1);
        var bi = cellObj.block.indexOf(cellObj.candidates);
        cellObj.block.splice(bi, 1);
        $g.countMemo.lines[cellObj.i][decidedNumber] = false;
        $g.countMemo.columns[cellObj.j][decidedNumber] = false;
        $g.countMemo.blocks[cellObj.bi][decidedNumber] = false;
        delete $g.leftCells[key];
        return removeCandidatesFromList($g, cellObj.lefts, decidedNumber, result);
    };

    var removeCandidatesFromList = function ($g, list, decidedNumber, result) {
        for (var li = 0, llen = list.length; li < llen; li++) {
            var candidates = list[li];
            var cellObj = $g.leftCells[candidates.key];
            if (!cellObj) continue;
            if (candidates.hash & decidedNumber) {
                if (!deleteCandidate($g, cellObj, decidedNumber, result)) {
                    return false;
                }
                result.removeCount++;
            }
        }
        return true;
    };

    var decideSingleNumberInList = function ($g, list, number, result) {
        for (var li = 0, llen = list.length; li < llen; li++) {
            var key = list[li].key;
            if (list[li].hash & number) {
                if (!$g.leftCells[key]) return true;
                if (!deleteAllCandedates($g, $g.leftCells[key], number, result)) {
                    return false;
                }
                return true;
            }
        }
        return false;
    };

    var removeByBlockAndLineColumnPatterns = function ($g, block, bi, result) {
        var len1 = block.length;
        if (len1 <= 1) return true;

        var workList = [];
        var generaLGroup = [];
        var lKeys = [];
        var cKeys = [];
        var linePatternMemo = {};
        var columnPatternMemo = {};
        var solvedNumberMemo = [];

        for (var bidx = 0; bidx < len1; bidx++) {
            var candidates = block[bidx];
            var nums = candidates.hash;
            generaLGroup.push(nums);
            var cellObj = $g.leftCells[candidates.key];
            if (lKeys.indexOf(cellObj.i) == -1) lKeys.push(cellObj.i);
            if (cKeys.indexOf(cellObj.j) == -1) cKeys.push(cellObj.j);
            if (!linePatternMemo[cellObj.i]) linePatternMemo[cellObj.i] = {};
            if (!columnPatternMemo[cellObj.j]) columnPatternMemo[cellObj.j] = {};
            solvedNumberMemo.push(0);
            workList.push(cellObj);
        }

        var linesGeneral = {};
        var columnsGeneral = {};
        for (var li = 0, len = lKeys.length; li < len; li++) {
            linesGeneral[lKeys[li]] = getGeneralNumGroupRemovedBlock($g.leftCells, $g.lines[lKeys[li]], bi);
        }
        for (var ci = 0, len = cKeys.length; ci < len; ci++) {
            columnsGeneral[cKeys[ci]] = getGeneralNumGroupRemovedBlock($g.leftCells, $g.columns[cKeys[ci]], bi);
        }

        for (var idx1 = 0; idx1 < len1; idx1++) {
            var numsHash = generaLGroup[idx1];
            var cellObj = workList[idx1];
            for (var idx2 = 0, nums = hashMemo[numsHash]; idx2 < nums.length; idx2++) {
                if (cellObj.candidates.length === 1) break;
                var num = nums[idx2];
                var tempGroup = generaLGroup.concat();
                tempGroup[idx1] = num;
                if (solvedNumberMemo[idx1] & num) continue;
                var foundCrossPattern = false;
                iterateGroupPatterns(tempGroup, 0, len1, function (pattern) {
                    var lWork = {};
                    var cWork = {};
                    for (var index2 = 0; index2 < len1; index2++) {
                        var cellObj = workList[index2];
                        if (!lWork[cellObj.i]) lWork[cellObj.i] = 0;
                        if (!cWork[cellObj.j]) cWork[cellObj.j] = 0;
                        lWork[cellObj.i] += pattern[index2];
                        cWork[cellObj.j] += pattern[index2];
                    }

                    for (var i3 = 0, len3 = lKeys.length; i3 < len3; i3++) {
                        var lKey = lKeys[i3];
                        var hash = lWork[lKey];
                        if (linePatternMemo[lKey][hash]) {
                            if (linePatternMemo[lKey][hash].result) continue;
                            else return true;
                        }
                        var lGroup = getRemovedNumsGroupGeneral(linesGeneral[lKey], hash);
                        if (!findGroupPattern(lGroup)) {
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
                        if (!findGroupPattern(cGroup)) {
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
                    var cellObj = $g.leftCells[cellObj.str];
                    if (!cellObj) continue;
                    if (!(cellObj.candidates.hash & num)) continue;
                    infomations.blockAndLineColumnPatternsRemoveCount++;
                    result.removeCount++;
                    if (!deleteCandidate($g, cellObj, num, result)) return false;
                }
            }
        }
        return true;
    };

    var getGeneralNumGroupRemovedBlock = function (leftCells, group, removedBlockIndex) {
        var numsGroup = [];
        for (var gi = 0, glen = group.length; gi < glen; gi++) {
            var cellObj = leftCells[group[gi].key];
            if (cellObj.bi == removedBlockIndex) continue;
            numsGroup.push(cellObj.candidates.hash);
        }
        return numsGroup;
    };

    var iterateGroupPatterns = function (group, startIndex, length, callBack) {
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

    var findGroupPattern = function (group) {
        var gLen = group.length;
        if (gLen === 0) return true;
        if (!optimizeGroup(group, gLen)) return false;
        if (gLen === 1) return true;

        var firstMember = hashMemo[group[0]];
        for (var i = 0, len = firstMember.length; i < len; i++) {
            var num = firstMember[i];
            var usedNumberHash = num;
            if (findGroupPatternSub(group, gLen, usedNumberHash, 1)) return true;
        }
        return false;
    };

    var findGroupPatternSub = function (group, length, usedNumberHash, memberIndex) {
        var pointingMember = hashMemo[group[memberIndex] - (usedNumberHash & group[memberIndex])];
        for (var i = 0, len = pointingMember.length; i < len; i++) {
            var num = pointingMember[i];
            if (memberIndex + 1 === length) return true;
            if (findGroupPatternSub(group, length, usedNumberHash + num, memberIndex + 1)) return true;
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

    var removeBySingleNumberPatternAll = function ($g, result) {
        for (var idx = 0; idx < CELL_LENGTH; idx++) {
            var num = 1 << idx;
            if (!removeBySingleNumberPattern($g, num, result)) return false;
        }
        return true;
    };

    var removeBySingleNumberPattern = function ($g, num, result) {
        var leftCount = CELL_LENGTH;
        var numberLeftCells = [];
        var numberLeftBlocks = [];
        var bKeys = [];
        for (var groupIndex = 1; groupIndex <= CELL_LENGTH; groupIndex++) {
            if ($g.countMemo.blocks[groupIndex][num]) {
                var block = $g.blocks[groupIndex];
                var blockCandidates = [];
                numberLeftBlocks.push(blockCandidates);
                bKeys.push(groupIndex);
                for (var mi = 0, len = block.length; mi < len; mi++) {
                    var cnd = $g.leftCells[block[mi].key];
                    if (cnd.candidates.hash & num) {
                        numberLeftCells.push(cnd);
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
        for (var li = 0, len = numberLeftCells.length; li < len; li++) {
            var target = numberLeftCells[li];
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
                var cellObj = $g.leftCells[target.str];
                if (!cellObj) continue;
                if (!(cellObj.candidates.hash & num)) continue;
                infomations.singleNumberPatternRemoveCount++;
                result.removeCount++;
                if (!deleteCandidate($g, cellObj, num, result)) return false;
            }
        }
        return true;
    };

    var getAllZeroArray = function (len) {
        var array = [];
        for (var i = 0; i < len; i++) array.push(0);
        return array;
    };

    var removeByChain = function ($g, result) {
        if ($g.leftCount > 55) return true;
        var onKeysSkipMemo = {};
        while ($g.chainReserveQueue.length) {
            var candidates = $g.chainReserveQueue.pop();
            cellObj = $g.leftCells[candidates.key];
            if (!cellObj) continue;
            if (cellObj.candidates.length != 2) continue;
            if (onKeysSkipMemo[cellObj.str]) continue;
            var biValue = hashMemo[cellObj.candidates.hash];
            var first = getChainResult($g, cellObj, biValue[0], biValue[1]);
            var second = getChainResult($g, cellObj, biValue[1], biValue[0]);

            if (first.err && second.err) return false;
            var trueResult = null;
            if (first.err) {
                trueResult = second;
            } else if (second.err) {
                trueResult = first;
            }

            if (trueResult) {
                var trkeys = trueResult.onKeysList;
                for (var trki, trklen = trkeys.length; trki < trklen; trki++) {
                    var trkey = trkeys[trki];
                    var cellObj = $g.leftCells[trkey];
                    if (!cellObj) continue;
                    result.removeCount++;
                    if (!deleteAllCandedates($g, cellObj, trueResult.onKeys[trkey], result)) return false;
                }
                continue;
            }

            var fkeys = first.onKeysList;
            var skeys = second.onKeysList;

            for (var fi = 0, flen = fkeys.length; fi < flen; fi++) {
                var fkey = fkeys[fi];
                if ($g.leftCells[fkey].candidates.length != 2) continue;
                for (var si = 0, slen = skeys.length; si < slen; si++) {
                    var skey = skeys[si];
                    if (skey != fkey) continue;
                    if (fkeys[fkey] != skeys[skey]) onKeysSkipMemo[fkey] = true;
                }
            }

            for (var fi = 0, flen = fkeys.length; fi < flen; fi++) {
                var fkey = fkeys[fi];
                for (var si = 0, slen = skeys.length; si < slen; si++) {
                    var skey = skeys[si];
                    if (fkey == skey && first.onKeys[fkey] == second.onKeys[skey]) {
                        var cellObj = $g.leftCells[fkey];
                        if (!cellObj) continue;
                        infomations.chainRemoveCount++;
                        result.removeCount++;
                        if (!deleteAllCandedates($g, $g.leftCells[fkey], first.onKeys[fkey], result)) return false;
                    }
                }
            }

            var overlappedNums = first.hash & second.hash;
            for (var ni = 0, nums = hashMemo[overlappedNums], nlen = nums.length; ni < nlen; ni++) {
                var num = nums[ni];
                var numRec1 = first.numsRecords[num];
                var numRec2 = second.numsRecords[num];
                if (
                    !deleteByChainResultCross($g, num, numRec1.lines, numRec2.columns, lcCross, first.onKeys, second.onKeys, result)
                    || !deleteByChainResultCross($g, num, numRec2.lines, numRec1.columns, lcCross, first.onKeys, second.onKeys, result)
                    || !deleteByChainResultCross($g, num, numRec1.blocks, numRec2.lines, blCross, first.onKeys, second.onKeys, result)
                    || !deleteByChainResultCross($g, num, numRec1.blocks, numRec2.columns, bcCross, first.onKeys, second.onKeys, result)
                    || !deleteByChainResultCross($g, num, numRec2.blocks, numRec1.lines, blCross, first.onKeys, second.onKeys, result)
                    || !deleteByChainResultCross($g, num, numRec2.blocks, numRec1.columns, bcCross, first.onKeys, second.onKeys, result)
                ) return false;

                if (
                    !deleteByChainResultSame($g, $g.lines, num, numRec1.lines, numRec2.lines, first.onKeysOrder[num].lines, second.onKeysOrder[num].lines, result)
                    || !deleteByChainResultSame($g, num, numRec1.columns, numRec2.columns, first.onKeysOrder[num].columns, second.onKeysOrder[num].columns, result)
                    || !deleteByChainResultSame($g, num, numRec1.blocks, numRec2.blocks, first.onKeysOrder[num].blocks, second.onKeysOrder[num].blocks, result)
                ) return false;

            }
        }
        return true;
    };

    var getChainResult = function ($g, cellObj, onNum, offNum) {
        var chainResult = {
            hash: 0,
            onKeys: {},
            offKeys: {},
            onKeysList: [],
            offKeysList: [],
            numsRecords: {},
            onKeysOrder: {},
            err: false,
            usedStrongLink: {}
        };
        if (!addChainResultOn($g, cellObj, onNum, chainResult)) {
            chainResult.err = true;
            return chainResult;
        }
        if (!addChainResultOff($g, cellObj, offNum, chainResult)) {
            chainResult.err = true;
            return chainResult;
        }
        return chainResult;
    };

    var addChainResultOn = function ($g, cellObj, onNum, chainResult) {
        if (!addChainResult(chainResult, cellObj, onNum)) return false;
        for (var li = 0, llen = cellObj.lefts.length; li < llen; li++) {
            var candidates = cellObj.lefts[li];
            if (candidates.length == 1) continue;
            var key = candidates.key;
            if ((candidates.hash & onNum) && (!chainResult.onKeys[key])) {
                if (candidates.length == 2) {
                    if (!addChainResultOn($g, $g.leftCells[key], candidates.hash - onNum, chainResult)) return false;
                } else {
                    if (!addChainResultOff($g, $g.leftCells[key], onNum, chainResult)) return false;
                }
            }
        }
        return true;
    };

    var addChainResultOff = function ($g, cellObj, offNum, chainResult, excludeGroup) {
        if (!chainResult.offKeys[cellObj.str]) {
            chainResult.offKeys[cellObj.str] = offNum;
            chainResult.offKeysList.push(cellObj.str);
        } else {
            if ((chainResult.offKeys[cellObj.str] & offNum)) return true;
            chainResult.offKeys[cellObj.str] += offNum;
            var leftNums = cellObj.candidates.hash - chainResult.offKeys[cellObj.str];
            if (leftNums == 0) return false;
            if (hashLengthMemo[leftNums] == 1) {
                if (!addChainResultOn($g, cellObj, leftNums, chainResult)) return true;
            }
        }
        if (excludeGroup !== 0)
            if (!addChainResultOffGroups($g, cellObj.line, cellObj.i, cellObj, offNum, $g.countMemo.numsMemo.lines, chainResult, 0)) return false;
        if (excludeGroup !== 1)
            if (!addChainResultOffGroups($g, cellObj.column, cellObj.j, cellObj, offNum, $g.countMemo.numsMemo.columns, chainResult, 1)) return false;
        if (excludeGroup !== 2)
            if (!addChainResultOffGroups($g, cellObj.block, cellObj.bi, cellObj, offNum, $g.countMemo.numsMemo.blocks, chainResult, 2)) return false;
        return true;
    };

    var addChainResultOffGroups = function ($g, group, gkey, cellObj, offNum, numsMemoGroup, chainResult, groupId) {
        if (numsMemoGroup[gkey][offNum] == 2) {
            for (var gi = 0, glen = group.length; gi < glen; gi++) {
                var candidates = group[gi];
                var key = candidates.key;
                if (key === cellObj.str) continue;
                if ((candidates.hash & offNum) && !chainResult.onKeys[key]) {
                    if (!addChainResultOn($g, $g.leftCells[key], offNum, chainResult)) return false;
                    for (var offNums = hashMemo[candidates.hash - offNum], ofni = 0, ofnlen = offNums.length; ofni < ofnlen; ofni++) {
                        if (!addChainResultOff($g, $g.leftCells[key], offNums[ofni], chainResult, groupId)) return false;
                    }
                    break;
                }
            }
        }
        return true;
    };

    var addChainResult = function (chainResult, cellObj, num) {
        chainResult.hash |= num;
        chainResult.onKeys[cellObj.str] = num;
        chainResult.onKeysList.push(cellObj.str);
        if (!chainResult.numsRecords[num]) chainResult.numsRecords[num] = { lines: [], columns: [], blocks: [] };
        if (!chainResult.onKeysOrder[num]) chainResult.onKeysOrder[num] = { lines: [], columns: [], blocks: [] };
        var numRecords = chainResult.numsRecords[num];
        var onKeysOrder = chainResult.onKeysOrder[num];
        if (numRecords.lines.indexOf(cellObj.i) != -1
            || numRecords.columns.indexOf(cellObj.j) != -1
            || numRecords.blocks.indexOf(cellObj.bi) != -1) {
            return false;
        }
        numRecords.lines.push(cellObj.i);
        numRecords.columns.push(cellObj.j);
        numRecords.blocks.push(cellObj.bi);
        onKeysOrder.lines.push(cellObj.str);
        onKeysOrder.columns.push(cellObj.str);
        onKeysOrder.blocks.push(cellObj.str);
        return true;
    };

    var deleteByChainResultCross = function ($g, num, g1, g2, crossMemo, onKeys1, onKeys2, result) {
        for (var g1i = 0, g1len = g1.length; g1i < g1len; g1i++) {
            var i1 = g1[g1i];
            for (var g2i = 0, g2len = g2.length; g2i < g2len; g2i++) {
                var i2 = g2[g2i];
                var targetKeys = crossMemo[i1][i2];
                for (var tki = 0, tklen = targetKeys.length; tki < tklen; tki++) {
                    var targetKey = targetKeys[tki];
                    if ((onKeys1[targetKey] & num) || (onKeys2[targetKey] & num)) continue;
                    var targetCellObj = $g.leftCells[targetKey];
                    if (targetCellObj && (targetCellObj.candidates.hash & num)) {
                        result.removeCount++;
                        infomations.chainRemoveCount++;
                        if (!deleteCandidate($g, targetCellObj, num, result)) return false;
                    }
                }
            }
        }
        return true;
    };

    var deleteByChainResultSame = function ($g, groups, num, gs1, gs2, onKeysOrder1, onKeysOrder2, result) {
        for (var gs1i = 0, gs1len = gs1.length; gs1i < gs1len; gs1i++) {
            var g1i = gs1[gs1i];
            for (var gs2i = 0, gs2len = gs2.length; gs2i < gs2len; gs2i++) {
                if (g1i != gs2[gs2i]) continue;
                var group = groups[g1i];
                for (var gi = 0, glen = group.length; gi < glen; gi++) {
                    var candidate = group[gi];
                    if (onKeysOrder1[gs1i] != candidate.key && onKeysOrder2[gs2i] != candidate.key) {
                        var cellObj = $g.leftCells[candidate.key];
                        if (!cellObj) continue;
                        if (cellObj.candidates.hash & num) {
                            result.removeCount++;
                            infomations.chainRemoveCount++;
                            if (!deleteCandidate($g, cellObj, num, result)) {
                                return false;
                            }
                        }
                        if (glen != group.length) {
                            gi = -1;
                            glen = group.length;
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
            if (candidates.length != 1) return result = false;
            var value = candidates.hash;

            if (!lines[i]) lines[i] = 0;
            if (lines[i] & value) return result = false;
            lines[i] += value;

            if (!columns[j]) columns[j] = 0;
            if (columns[i] & value) return result = false;
            columns[i] += value;

            if (!blocks[bi]) blocks[bi] = 0;
            if (blocks[i] & value) return result = false;
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
        for (var i = 0; i < CELL_LENGTH; i++) {
            for (var j = 0; j < CELL_LENGTH; j++) {
                var candidates = memoMap[cellNames[i][j]];
                if (candidates.length === 1) {
                    q[i][j] = candidates.hash;
                }
            }
        }

        var newMemoMap = copyMemoMap(memoMap);
        var cellName = cellNames[oi1 - 1][oj1 - 1];
        newMemoMap[cellName] = { hash: candidate, length: 1, key: cellName };
        q[oi1 - 1][oj1 - 1] = candidate;
        return [q, newMemoMap];
    };

    var copyMemoMap = function (memoMap) {
        var newMemoMap = {};
        for (var i = 0; i < CELL_LENGTH; i++) {
            for (var j = 0; j < CELL_LENGTH; j++) {
                var cellName = cellNames[i][j];
                newMemoMap[cellName] = { hash: memoMap[cellName].hash, length: memoMap[cellName].length, key: cellName };
            }
        }
        return newMemoMap;
    };

    var memoMapToAnswer = function (memoMap) {
        var answer = [];
        for (var i = 0; i < CELL_LENGTH; i++) {
            var line = [];
            for (var j = 0; j < CELL_LENGTH; j++) {
                line.push((Math.log2(memoMap[cellNames[i][j]].hash) + 1));
            }
            answer.push(line);
        }
        return answer;
    }

    var memoMapHashToArray = function (memoMap) {
        var memoMapArray = [];
        for (var i = 0; i < CELL_LENGTH; i++) {
            var line = [];
            for (var j = 0; j < CELL_LENGTH; j++) {
                line.push(hashMemoLog2[memoMap[cellNames[i][j]].hash].concat());
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
        exports.warmup = warmup;
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