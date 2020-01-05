var exports = exports;
if (!exports) exports = {};
var solver = exports;
(function () {
    var version = "1.4.0";
    var LEN = 9;

    var hashMemo = [], hashMemoLog2 = [], hashLengthMemo = [];
    var groupIds = { rows: {}, cols: {}, blos: {} };
    var allCells, cellNames;
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

        var gid = 1;
        for (var gi = 1; gi <= LEN; gi++) {
            groupIds.rows[gi] = gid = gid << 1;
            groupIds.cols[gi] = gid = gid << 1;
            groupIds.blos[gi] = gid = gid << 1;
        }

        warmupq = [];
        cellNames = [];
        for (var i = 0; i < LEN; i++) {
            var cellNameRow = [];
            var warmupRow = [];
            for (var j = 0; j < LEN; j++) {
                var cellName = i * 9 + j;
                cellNameRow.push(cellName)
                warmupRow.push(0);
            }
            cellNames.push(cellNameRow);
            warmupq.push(warmupRow);
        }

        allCells = [];
        for (var i = 1; i <= LEN; i++) {
            for (var j = 1; j <= LEN; j++) {
                var bi = Math.floor((j - 1) / 3) + Math.floor((i - 1) / 3) * 3 + 1;
                var cellName = cellNames[i - 1][j - 1];
                var cell = {
                    str: cellName, i: i, j: j, bi: bi,
                    ghash: groupIds.rows[i] | groupIds.cols[j] | groupIds.blos[bi]
                };
                allCells.push(cell);
            }
        }
    };

    var warmup = function () {
        for (var i = 0; i < 10; i++) analizeSudoku(warmupq);
    };

    var iterateAllCell = function (func) {
        for (var i = 0, len = allCells.length; i < len; i++) {
            var cell = allCells[i];
            if (!func(cell.str, cell.i, cell.j, cell.bi)) return false;
        }
        return true;
    };

    var infomations = {
        callCount: 0,
        maxDepth: 1,
        decideCandidateRemoveCount: 0,
        bloAndRowColPatternsRemoveCount: 0,
        singleNumberPatternRemoveCount: 0,
        chainRemoveCount: 0
    };

    var clearInfomations = function () {
        infomations = {
            callCount: 0,
            maxDepth: 1,
            decideCandidateRemoveCount: 0,
            bloAndRowColPatternsRemoveCount: 0,
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
        for (var i = 0; i < LEN; i++) {
            var row = [];
            for (var j = 0; j < LEN; j++) {
                var num = q[i][j];
                if (num) {
                    row.push(1 << (num - 1));
                } else {
                    row.push(0);
                }
            }
            bq.push(row);
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
            leftCount: LEN * LEN,
            leftCells: {},
            rows: {},
            cols: {},
            blos: {},
            countMemo: {
                rows: {}, cols: {}, blos: {},
                numsMemo: { rows: {}, cols: {}, blos: {} },
                numsLeft: { 1: LEN, 2: LEN, 4: LEN, 8: LEN, 16: LEN, 32: LEN, 64: LEN, 128: LEN, 256: LEN }
            },
            chainReserveQueue: []
        };

        var removeCount = 0;
        var result = { err: false, removeCount: 0 };
        var solved = false;
        initQuestion(q, memoMap, $g, useMemoMap);

        result = { err: false, removeCount: 0 };
        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
                var str = cellNames[i][j];
                if (q[i][j]) {
                    var cellObj = $g.leftCells[str];
                    if (!cellObj) continue;
                    deleteAllCandedatesInitQ($g, cellObj, q[i][j]);
                }
            }
        }

        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
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

            result.removeCount = 0;
            if (!removeByChain($g, result)) return endAsError(memoMap);
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }
            removeCount += result.removeCount;

            if ($g.leftCount >= 65) break;

            result.removeCount = 0;
            for (var idxb = 1; idxb < LEN; idxb++) {
                if (!removeByBloAndRowColPatterns($g, $g.blos[idxb], idxb, result)) return endAsError(memoMap);
            }
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }
            removeCount += result.removeCount;
            if (removeCount == 0) break;
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
                        leftCount += $g.countMemo.numsMemo.rows[ii][nlist[jj]];
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
                for (var ni1 = 0, nlen1 = nums1.length; ni1 < nlen1; ni1++) {
                    for (var ni2 = 0, nlen2 = nums2.length; ni2 < nlen2; ni2++) {
                        if (nums1[ni1] == nums2[ni2] && (minNumObj1.ghash & minNumObj2.ghash)) continue;
                        patterns.push([
                            { i: minNumObj1.i, j: minNumObj1.j, num: nums1[ni1] },
                            { i: minNumObj2.i, j: minNumObj2.j, num: nums2[ni2] },
                        ]);
                    }
                }
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
                var newQ = createQuestionFromMemoMap(memoMap, pattern);
                var q1 = newQ[0];
                var memoMap1 = newQ[1];
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
        var rowsNumsMemo = {};
        var colsNumsMemo = {};
        var blosNumsMemo = {};

        for (var listIndex = 1; listIndex <= LEN; listIndex++) {
            var rowMemo = rowsNumsMemo[listIndex] = {};
            var colMemo = colsNumsMemo[listIndex] = {};
            var bloMemo = blosNumsMemo[listIndex] = {};

            for (var num = 0; num < LEN; num++) {
                var hash = 1 << num;
                if (useMemoMap) {
                    rowMemo[hash] = 0;
                    colMemo[hash] = 0;
                    bloMemo[hash] = 0;
                } else {
                    rowMemo[hash] = LEN;
                    colMemo[hash] = LEN;
                    bloMemo[hash] = LEN;
                }
            }
        }

        if (useMemoMap) {
            for (var cli = 0, len = allCells.length; cli < len; cli++) {
                var cell = allCells[cli];
                var memo = memoMap[cell.str];
                for (var num = 0; num < LEN; num++) {
                    var hash = 1 << num;
                    if (memo.hash & hash) {
                        rowsNumsMemo[cell.i][hash]++;
                        colsNumsMemo[cell.j][hash]++;
                        blosNumsMemo[cell.bi][hash]++;
                    }
                }
            }
        }

        $g.countMemo.numsMemo = { rows: rowsNumsMemo, cols: colsNumsMemo, blos: blosNumsMemo };
        for (var num1 = 1; num1 <= LEN; num1++) {
            $g.rows[num1] = [];
            $g.cols[num1] = [];
            $g.blos[num1] = [];
            $g.countMemo.rows[num1] = getNewNumberMemo();
            $g.countMemo.cols[num1] = getNewNumberMemo();
            $g.countMemo.blos[num1] = getNewNumberMemo();
        }

        for (var cli = 0, len = allCells.length; cli < len; cli++) {
            var cell = allCells[cli];
            var candidates = memoMap[cell.str];
            $g.rows[cell.i].push(candidates);
            $g.cols[cell.j].push(candidates);
            $g.blos[cell.bi].push(candidates);
            $g.leftCells[cell.str] = {
                str: cell.str,
                i: cell.i,
                j: cell.j,
                bi: cell.bi,
                ghash: cell.ghash,
                candidates: memoMap[cell.str],
                row: $g.rows[cell.i],
                col: $g.cols[cell.j],
                blo: $g.blos[cell.bi],
                lefts: []
            };
        }

        for (var cli = 0, len = allCells.length; cli < len; cli++) {
            var cell = allCells[cli];
            var cellObj = $g.leftCells[cell.str];
            for (var ri = 0, rlen = cellObj.row.length; ri < rlen; ri++) {
                var candidates = cellObj.row[ri];
                if (candidates.key !== cell.str) cellObj.lefts.push(candidates);
            }
            for (var ci = 0, clen = cellObj.col.length; ci < clen; ci++) {
                var candidates = cellObj.col[ci];
                if (candidates.key !== cell.str) cellObj.lefts.push(candidates);
            }
            for (var bi = 0, blen = cellObj.blo.length; bi < blen; bi++) {
                var candidates = cellObj.blo[bi];
                if (candidates.key !== cell.str) {
                    var cellObj2 = $g.leftCells[candidates.key];
                    if (cellObj2.i != cell.i && cellObj2.j != cell.j) cellObj.lefts.push(candidates);
                }
            }
        }
    };

    var getNewMemoMap = function () {
        var memoMap = {};
        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
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
        for (var dellNums = hashMemo[delHash], i = 0, len = dellNums.length; i < len; i++) {
            deleteCandidateInitQ($g, cellObj, dellNums[i]);
        }
    };

    var deleteCandidateInitQ = function ($g, cellObj, deleteNumber) {
        cellObj.candidates.hash -= deleteNumber;
        cellObj.candidates.length--;
        $g.countMemo.numsMemo.rows[cellObj.i][deleteNumber]--;
        $g.countMemo.numsMemo.cols[cellObj.j][deleteNumber]--;
        $g.countMemo.numsMemo.blos[cellObj.bi][deleteNumber]--;
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
        var row = $g.countMemo.numsMemo.rows[cellObj.i];
        row[deleteNumber]--;
        var col = $g.countMemo.numsMemo.cols[cellObj.j];
        col[deleteNumber]--;
        var blo = $g.countMemo.numsMemo.blos[cellObj.bi];
        blo[deleteNumber]--;

        if (row[deleteNumber] == 0 || col[deleteNumber] == 0 || blo[deleteNumber] == 0) {
            return false;
        }

        if (candidates.hash === 0) return !(result.err = true);

        if (candidates.length === 1)
            if (!decideCandidates($g, cellObj.str, candidates.hash, result)) {
                return false;
            }

        if ($g.countMemo.rows[cellObj.i][deleteNumber] && row[deleteNumber] == 1) {
            if (!decideSingleNumberInList($g, cellObj.row, deleteNumber, result)) {
                return false;
            }
        }
        if ($g.countMemo.cols[cellObj.j][deleteNumber] && col[deleteNumber] == 1) {
            if (!decideSingleNumberInList($g, cellObj.col, deleteNumber, result)) {
                return false;
            }
        }
        if ($g.countMemo.blos[cellObj.bi][deleteNumber] && blo[deleteNumber] == 1) {
            if (!decideSingleNumberInList($g, cellObj.blo, deleteNumber, result)) {
                return false;
            }
        }
        if (candidates.length == 2) $g.chainReserveQueue.push(candidates);
        return true;
    };

    var endAsError = function (memoMap) {
        return { result: false, dup: false, invalid: true, msg: "no solution", memoMap: memoMap, err: true };
    };

    var decideCandidates = function ($g, key, decidedNumber, result) {
        $g.leftCount--;
        $g.countMemo.numsLeft[decidedNumber]--;
        var cellObj = $g.leftCells[key];
        var ri = cellObj.row.indexOf(cellObj.candidates);
        cellObj.row.splice(ri, 1);
        var ci = cellObj.col.indexOf(cellObj.candidates);
        cellObj.col.splice(ci, 1);
        var bi = cellObj.blo.indexOf(cellObj.candidates);
        cellObj.blo.splice(bi, 1);
        $g.countMemo.rows[cellObj.i][decidedNumber] = false;
        $g.countMemo.cols[cellObj.j][decidedNumber] = false;
        $g.countMemo.blos[cellObj.bi][decidedNumber] = false;
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

    var removeByBloAndRowColPatterns = function ($g, blo, bi, result) {
        if ($g.leftCount >= 50) return true;
        var len1 = blo.length;
        if (len1 <= 1) return true;

        var workList = [];
        var generaLGroup = [];
        var rKeys = [];
        var cKeys = [];
        var rowPatternMemo = {};
        var colPatternMemo = {};
        var solvedNumberMemo = [];

        for (var bidx = 0; bidx < len1; bidx++) {
            var candidates = blo[bidx];
            var nums = candidates.hash;
            generaLGroup.push(nums);
            var cellObj = $g.leftCells[candidates.key];
            if (rKeys.indexOf(cellObj.i) == -1) rKeys.push(cellObj.i);
            if (cKeys.indexOf(cellObj.j) == -1) cKeys.push(cellObj.j);
            if (!rowPatternMemo[cellObj.i]) rowPatternMemo[cellObj.i] = {};
            if (!colPatternMemo[cellObj.j]) colPatternMemo[cellObj.j] = {};
            solvedNumberMemo.push(0);
            workList.push(cellObj);
        }

        var rowsGeneral = {};
        var colsGeneral = {};
        for (var ri = 0, len = rKeys.length; ri < len; ri++) {
            rowsGeneral[rKeys[ri]] = getGeneralNumGroupRemovedBlo($g.leftCells, $g.rows[rKeys[ri]], bi);
        }
        for (var ci = 0, len = cKeys.length; ci < len; ci++) {
            colsGeneral[cKeys[ci]] = getGeneralNumGroupRemovedBlo($g.leftCells, $g.cols[cKeys[ci]], bi);
        }

        for (var idx1 = 0; idx1 < len1; idx1++) {
            var numsHash = generaLGroup[idx1];
            var cellObj = workList[idx1];
            for (var idx2 = 0, nums = hashMemo[numsHash]; idx2 < nums.length; idx2++) {
                if (cellObj.candidates.length === 1) break;
                var num = nums[idx2];
                if (!(cellObj.candidates.hash & num)) continue;
                var tempGroup = generaLGroup.concat();
                tempGroup[idx1] = num;
                if (solvedNumberMemo[idx1] & num) continue;
                var foundCrossPattern = false;
                iterateGroupPatterns(tempGroup, len1, function (pattern) {
                    var rWork = {};
                    var cWork = {};
                    for (var index2 = 0; index2 < len1; index2++) {
                        var cellObj = workList[index2];
                        if (!rWork[cellObj.i]) rWork[cellObj.i] = 0;
                        if (!cWork[cellObj.j]) cWork[cellObj.j] = 0;
                        rWork[cellObj.i] += pattern[index2];
                        cWork[cellObj.j] += pattern[index2];
                    }

                    for (var i3 = 0, len3 = rKeys.length; i3 < len3; i3++) {
                        var rKey = rKeys[i3];
                        var hash = rWork[rKey];
                        if (rowPatternMemo[rKey][hash]) {
                            if (rowPatternMemo[rKey][hash].result) continue;
                            else return true;
                        }
                        var rGroup = getRemovedNumsGroupGeneral(rowsGeneral[rKey], hash);
                        if (!findGroupPattern(rGroup)) {
                            rowPatternMemo[rKey][hash] = { result: false };
                            return true;
                        } else {
                            rowPatternMemo[rKey][hash] = { result: true };
                        }
                    }

                    for (var i4 = 0, len4 = cKeys.length; i4 < len4; i4++) {
                        var cKey = cKeys[i4];
                        var hash = cWork[cKey];
                        if (colPatternMemo[cKey][hash]) {
                            if (colPatternMemo[cKey][hash].result) continue;
                            else return true;
                        }

                        var cGroup = getRemovedNumsGroupGeneral(colsGeneral[cKey], hash);
                        if (!findGroupPattern(cGroup)) {
                            colPatternMemo[cKey][hash] = { result: false };
                            return true;
                        } else {
                            colPatternMemo[cKey][hash] = { result: true };
                        }
                    }

                    for (var pi = 0; pi < len1; pi++) {
                        solvedNumberMemo[pi] |= pattern[pi];
                    }

                    foundCrossPattern = true;
                    return false;
                });
                if (!foundCrossPattern) {
                    infomations.bloAndRowColPatternsRemoveCount++;
                    result.removeCount++;
                    if (!deleteCandidate($g, cellObj, num, result)) return false;
                }
            }
        }
        return true;
    };

    var getGeneralNumGroupRemovedBlo = function (leftCells, group, removedBloIndex) {
        var numsGroup = [];
        for (var gi = 0, glen = group.length; gi < glen; gi++) {
            var cellObj = leftCells[group[gi].key];
            if (cellObj.bi == removedBloIndex) continue;
            numsGroup.push(cellObj.candidates.hash);
        }
        return numsGroup;
    };

    var iterateGroupPatterns = function (group, length, callBack) {
        if (length === 0) return callBack([]);
        var indexes = [];
        for (var i = 0; i < length; i++) {
            indexes.push(0);
        }

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
                    if (i !== self) {
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
        for (var idx = 0; idx < LEN; idx++) {
            var num = 1 << idx;
            if (!removeBySingleNumberPattern($g, num, result)) return false;
        }
        return true;
    };

    var removeBySingleNumberPattern = function ($g, num, result) {
        if ($g.countMemo.numsLeft[num] <= 2 || $g.countMemo.numsLeft[num] == 9) return true;
        var numberLeftCells = [];
        var numberLeftBlos = [];
        var bKeys = [];
        for (var groupIndex = 1; groupIndex <= LEN; groupIndex++) {
            if ($g.countMemo.blos[groupIndex][num]) {
                var blo = $g.blos[groupIndex];
                var bloCandidates = [];
                numberLeftBlos.push(bloCandidates);
                bKeys.push(groupIndex);
                for (var mi = 0, len = blo.length; mi < len; mi++) {
                    var cnd = $g.leftCells[blo[mi].key];
                    if (cnd.candidates.hash & num) {
                        numberLeftCells.push(cnd);
                        bloCandidates.push(cnd);
                    }
                }
            }
        }

        var indexes = [];
        var solvedCells = [];
        for (var li = 0, len = numberLeftCells.length; li < len; li++) {
            var target = numberLeftCells[li];
            if (solvedCells.indexOf([target.str]) != -1) {
                continue;
            }
            if (!(target.candidates.hash & num)) continue;
            if (target.candidates.length === 1) continue;
            var bLen = bKeys.length;
            indexes = getAllZeroArray(bLen);
            var occupiedGroups = 0;
            var pattern = new Array(bLen);
            var targetBkeyIndex = bKeys.indexOf(target.bi);
            occupiedGroups = target.ghash;
            var ghashHistory = [];
            pattern[targetBkeyIndex] = target.str;
            var foundPattern = true;
            for (var bKeyIndex = 0; bKeyIndex < bLen; bKeyIndex++) {
                if (target.bi === bKeys[bKeyIndex]) continue;
                var foundCandidate = false;
                var leftCells = numberLeftBlos[bKeyIndex];
                for (var len = leftCells.length; indexes[bKeyIndex] < len; indexes[bKeyIndex]++) {
                    var subTarget = leftCells[indexes[bKeyIndex]];
                    if (!(occupiedGroups & subTarget.ghash)) {
                        occupiedGroups += subTarget.ghash;
                        ghashHistory.push(subTarget.ghash);
                        pattern[bKeyIndex] = subTarget.str;
                        foundCandidate = true;
                        break;
                    }
                }
                if (foundCandidate) {
                    continue;
                } else {
                    if (bKeyIndex === 0 ||
                        (bKeyIndex === 1 && (indexes[0] + 1 >= numberLeftBlos[0].length || target.bi === bKeys[0]))) {
                        foundPattern = false;
                        break;
                    }
                    indexes[bKeyIndex] = 0;
                    occupiedGroups -= ghashHistory.pop();
                    if (targetBkeyIndex !== bKeyIndex - 1) {
                        pattern[bKeyIndex - 1] = undefined;
                    } else if (bKeyIndex > 1) {
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
                infomations.singleNumberPatternRemoveCount++;
                result.removeCount++;
                if (!deleteCandidate($g, target, num, result)) return false;
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
        while ($g.chainReserveQueue.length) {
            var candidates = $g.chainReserveQueue.pop();
            cellObj = $g.leftCells[candidates.key];
            if (!cellObj) continue;
            if (cellObj.candidates.length != 2) continue;
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
                for (var trki = 0, trklen = trkeys.length; trki < trklen; trki++) {
                    var trkey = trkeys[trki];
                    var cellObj = $g.leftCells[trkey];
                    if (!cellObj) continue;
                    result.removeCount++;
                    infomations.chainRemoveCount++;
                    if (!deleteAllCandedates($g, cellObj, trueResult.onKeys[trkey], result)) return false;
                }
                continue;
            }

            var overlappedNums = first.hash & second.hash;
            if (overlappedNums) {
                var fkeys = first.onKeysList;
                var skeys = second.onKeysList;
                for (var fi = 0, flen = fkeys.length; fi < flen; fi++) {
                    var fkey = fkeys[fi];
                    if (!(first.onKeys[fkey] & overlappedNums)) continue;
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
            }

            var fkeys = first.offKeysList;
            var skeys = second.offKeysList;
            for (var fi = 0, flen = fkeys.length; fi < flen; fi++) {
                var fkey = fkeys[fi];
                for (var si = 0, slen = skeys.length; si < slen; si++) {
                    var skey = skeys[si];
                    var offNumHash;
                    if (fkey == skey && (offNumHash = first.offKeys[fkey] & second.offKeys[skey])) {
                        var cellObj = $g.leftCells[fkey];
                        if (!cellObj) continue;
                        for (var offi = 0, nums = hashMemo[offNumHash], nlen = nums.length; offi < nlen; offi++) {
                            var num = nums[offi];
                            if (cellObj.candidates.hash & num) {
                                infomations.chainRemoveCount++;
                                result.removeCount++;
                                if (!deleteCandidate($g, cellObj, num, result)) return false;
                            }
                        }
                    }
                }
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
            err: false
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
            if ((candidates.hash & onNum)) {
                if (candidates.length == 2 && !chainResult.onKeys[key]) {
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
                if (chainResult.onKeys[cellObj.str]) {
                    if (chainResult.onKeys[cellObj.str] != leftNums) return false;
                } else {
                    if (!addChainResultOn($g, cellObj, leftNums, chainResult)) return false;
                }
            }
        }
        if (excludeGroup !== 0)
            if (!addChainResultOffGroups($g, cellObj.row, cellObj.i, cellObj, offNum, $g.countMemo.numsMemo.rows, chainResult, 0)) return false;
        if (excludeGroup !== 1)
            if (!addChainResultOffGroups($g, cellObj.col, cellObj.j, cellObj, offNum, $g.countMemo.numsMemo.cols, chainResult, 1)) return false;
        if (excludeGroup !== 2)
            if (!addChainResultOffGroups($g, cellObj.blo, cellObj.bi, cellObj, offNum, $g.countMemo.numsMemo.blos, chainResult, 2)) return false;
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
        if (!chainResult.numsRecords[num]) chainResult.numsRecords[num] = 0;
        var numRecords = chainResult.numsRecords[num];
        if (numRecords & cellObj.ghash) {
            return false;
        }
        chainResult.numsRecords[num] |= cellObj.ghash;
        return true;
    };

    var validateMemoMap = function (memoMap) {
        var rows = {};
        var cols = {};
        var blos = {};

        for (var cli = 0, len = allCells.length; cli < len; cli++) {
            var cell = allCells[cli];

            var candidates = memoMap[cell.str];
            if (candidates.length != 1) return false;
            var value = candidates.hash;

            if (!rows[cell.i]) rows[cell.i] = 0;
            if (rows[cell.i] & value) return false;
            rows[cell.i] += value;

            if (!cols[cell.j]) cols[cell.j] = 0;
            if (cols[cell.i] & value) return false;
            cols[cell.i] += value;

            if (!blos[cell.bi]) blos[cell.bi] = 0;
            if (blos[cell.i] & value) return false;
            blos[cell.i] += value;
        }
        return true;
    };

    var validateQuestion = function (q) {
        var rows = new Array(LEN);
        var cols = new Array(LEN);
        var blos = new Array(LEN);
        for (var cli = 0, len = allCells.length; cli < len; cli++) {
            var cell = allCells[cli];
            var i = cell.i - 1;
            var j = cell.j - 1;
            var bi = cell.bi - 1;
            var num;
            if (!(num = q[i][j])) return true;
            var row = rows[i] ? rows[i] : rows[i] = [];
            var col = cols[j] ? cols[j] : cols[j] = [];
            var blo = blos[bi] ? blos[bi] : blos[bi] = [];
            if (row.indexOf(num) === -1 && col.indexOf(num) === -1 && blo.indexOf(num) === -1) {
                row.push(num);
                col.push(num);
                blo.push(num);
            } else {
                return false;
            }
        }
        return true;
    };

    var createQuestionFromMemoMap = function (memoMap, pattern) {
        var q = [];
        for (var i = 0; i < LEN; i++) {
            q.push([]);
            for (var j = 0; j < LEN; j++) {
                q[i].push(0);
            }
        }
        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
                var candidates = memoMap[cellNames[i][j]];
                if (candidates.length === 1) {
                    q[i][j] = candidates.hash;
                }
            }
        }

        var newMemoMap = copyMemoMap(memoMap);
        for (var pi = 0, plen = pattern.length; pi < plen; pi++) {
            var temporary = pattern[pi];
            var cellName = cellNames[temporary.i - 1][temporary.j - 1];
            newMemoMap[cellName] = { hash: temporary.num, length: 1, key: cellName };
            q[temporary.i - 1][temporary.j - 1] = temporary.num;
        }
        return [q, newMemoMap];
    };

    var copyMemoMap = function (memoMap) {
        var newMemoMap = {};
        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
                var cellName = cellNames[i][j];
                newMemoMap[cellName] = { hash: memoMap[cellName].hash, length: memoMap[cellName].length, key: cellName };
            }
        }
        return newMemoMap;
    };

    var memoMapToAnswer = function (memoMap) {
        var answer = [];
        for (var i = 0; i < LEN; i++) {
            var row = [];
            for (var j = 0; j < LEN; j++) {
                row.push((Math.log2(memoMap[cellNames[i][j]].hash) + 1));
            }
            answer.push(row);
        }
        return answer;
    }

    var memoMapHashToArray = function (memoMap) {
        var memoMapArray = [];
        for (var i = 0; i < LEN; i++) {
            var row = [];
            for (var j = 0; j < LEN; j++) {
                row.push(hashMemoLog2[memoMap[cellNames[i][j]].hash].concat());
            }
            memoMapArray.push(row);
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