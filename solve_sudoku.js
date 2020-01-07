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
                    key: cellName, i: i, j: j, bi: bi,
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
            if (!func(cell.key, cell.i, cell.j, cell.bi)) return false;
        }
        return true;
    };

    var getNewInfomations = function () {
        return {
            callCount: 0,
            maxDepth: 1,
            removeCount: {
                decideCandidate: 0,
                singleNumberPattern: 0,
                biValueChain: 0,
                crossStrongLinkChain: 0,
                groupInclusive: 0
            },
            cost: {
                singleNumberPattern: 0,
                biValueChain: 0,
                crossStrongLinkChain: 0,
                groupInclusive: 0
            },
            removeCountPerMs: {
                singleNumberPattern: 0,
                biValueChain: 0,
                crossStrongLinkChain: 0,
                groupInclusive: 0
            }
        };
    };

    var infomations = getNewInfomations();

    var clearInfomations = function () {
        infomations = getNewInfomations();
    };

    var getInfomations = function () {
        var f = infomations;
        f.removeCountPerMs.singleNumberPattern = f.removeCount.singleNumberPattern * 1000000 / f.cost.singleNumberPattern;
        f.removeCountPerMs.biValueChain = f.removeCount.biValueChain * 1000000 / f.cost.biValueChain;
        f.removeCountPerMs.crossStrongLinkChain = f.removeCount.crossStrongLinkChain * 1000000 / f.cost.crossStrongLinkChain;
        f.removeCountPerMs.groupInclusive = f.removeCount.groupInclusive * 1000000 / f.cost.groupInclusive;
        return infomations;
    };

    var analizeSudoku = function (q) {
        if (!validateQuestion(q)) return { result: false, dup: false, invalid: true, memoMap: getNewMemoMap(), msg: "ninvalid question", countMemo: null };
        return solveSudoku(transformQToBit(q), 1, true, null);
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
            memoMap: memoMap,
            rows: {},
            cols: {},
            blos: {},
            countMemo: {
                rows: {}, cols: {}, blos: {},
                numsMemo: { rows: {}, cols: {}, blos: {} },
                numsLeft: { 1: LEN, 2: LEN, 4: LEN, 8: LEN, 16: LEN, 32: LEN, 64: LEN, 128: LEN, 256: LEN }
            },
            biValueChainQueue: []
        };

        var removeCount = 0;
        var result = { removeCount: 0 };
        var solved = false;
        initQuestion(q, memoMap, $g, useMemoMap);

        result = { removeCount: 0 };
        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
                var key = cellNames[i][j];
                if (q[i][j]) {
                    var candidates = $g.memoMap[key];
                    deleteAllCandedatesInitQ($g, candidates, q[i][j]);
                }
            }
        }

        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
                if (q[i][j]) {
                    var candidates = $g.memoMap[cellNames[i][j]];
                    if (!candidates.solved) {
                        if (!decideCandidates($g, candidates.cell.key, q[i][j], result)) return endAsError(memoMap);
                    }
                }
            }
        }

        infomations.removeCount.decideCandidate += result.removeCount;
        if ($g.leftCount === 0) solved = true;
        var nano = null;
        var diff = null;
        while (!solved) {
            if ($g.leftCount >= 75) break;
            removeCount = 0;
            result.removeCount = 0;
            nano = process.hrtime();
            if (!removeBySingleNumberPatternAll($g, result)) return endAsError(memoMap);
            diff = process.hrtime(nano);
            infomations.cost.singleNumberPattern += diff[0] * 1e9 + diff[1];
            removeCount += result.removeCount;
            infomations.removeCount.singleNumberPattern += result.removeCount;
            result.removeCount = 0;

            if ($g.leftCount === 0) {
                solved = true;
                break;
            }

            nano = process.hrtime();
            if (!removeByBiValueChain($g, result)) return endAsError(memoMap);
            diff = process.hrtime(nano);
            infomations.cost.biValueChain += diff[0] * 1e9 + diff[1];
            removeCount += result.removeCount;
            infomations.removeCount.biValueChain += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }


            if ($g.leftCount >= 65) break;

            nano = process.hrtime();
            if (!removeByCrossStrongLinkChain($g, result)) return endAsError(memoMap);
            diff = process.hrtime(nano);
            infomations.cost.crossStrongLinkChain += diff[0] * 1e9 + diff[1];
            removeCount += result.removeCount;
            infomations.removeCount.crossStrongLinkChain += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }

            nano = process.hrtime();
            if (!removeByGroupInclusive($g, result)) return endAsError(memoMap);
            diff = process.hrtime(nano);
            infomations.cost.groupInclusive += diff[0] * 1e9 + diff[1];
            removeCount += result.removeCount;
            infomations.removeCount.groupInclusive += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }
            if (removeCount == 0) break;
        }

        if ($g.leftCount === 0) {
            if (validateMemoMap(memoMap)) {
                return { result: true, dup: false, invalid: false, memoMap: memoMap, msg: "solved", countMemo: $g.countMemo };
            } else {
                return { result: false, dup: false, invalid: false, memoMap: memoMap, msg: "no solution", countMemo: $g.countMemo };
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
            var candidates = null;
            if (useDoubleTemporary) {
                var minLenCnd1 = null;
                var minLenCnd2 = null;
                for (var ai = 0, alen = allCells.length; ai < alen; ai++) {
                    candidates = $g.memoMap[allCells[ai].key];
                    if (candidates.solved) continue;
                    if (!minLenCnd1) {
                        minLenCnd1 = candidates;
                        continue;
                    }
                    var num = candidates.length;
                    if (num < minNum) {
                        minNum = num;
                        minLenCnd2 = minLenCnd1;
                        minLenCnd1 = candidates;
                    } else if (num == minNum) {
                        minLenCnd2 = candidates;
                    }
                }

                var nums1 = hashMemo[minLenCnd1.hash];
                var nums2 = hashMemo[minLenCnd2.hash];
                for (var ni1 = 0, nlen1 = nums1.length; ni1 < nlen1; ni1++) {
                    for (var ni2 = 0, nlen2 = nums2.length; ni2 < nlen2; ni2++) {
                        if (nums1[ni1] == nums2[ni2] && (minLenCnd1.cell.ghash & minLenCnd2.cell.ghash)) continue;
                        patterns.push([
                            { cell: minLenCnd1.cell, num: nums1[ni1] },
                            { cell: minLenCnd2.cell, num: nums2[ni2] },
                        ]);
                    }
                }
            } else {
                var minLenCnd = null;
                for (var ai = 0, alen = allCells.length; ai < alen; ai++) {
                    candidates = $g.memoMap[allCells[ai].key];
                    if (candidates.solved) continue;
                    var num = candidates.length;
                    if (num < minNum) {
                        minNum = num;
                        minLenCnd = candidates;
                        if (num == 2) break;
                    }
                }
                var nums = hashMemo[minLenCnd.hash];
                for (var ni = 0, nlen = nums.length; ni < nlen; ni++)
                    patterns.push([{ cell: minLenCnd.cell, num: nums[ni] }]);
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
                var memo = memoMap[cell.key];
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
            var candidates = memoMap[cell.key];
            $g.rows[cell.i].push(candidates);
            $g.cols[cell.j].push(candidates);
            $g.blos[cell.bi].push(candidates);
        }
    };

    var getNewMemoMap = function () {
        var memoMap = {};
        var index = 0;
        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
                var cellName = cellNames[i][j];
                memoMap[cellName] = createCandidates(511, 9, allCells[index]);
                index++;
            }
        }
        return memoMap;
    };

    var createCandidates = function (hash, length, cell) {
        return { hash: hash, length: length, cell: cell, solved: false };
    };

    var getNewNumberMemo = function () {
        return { 1: true, 2: true, 4: true, 8: true, 16: true, 32: true, 64: true, 128: true, 256: true };
    };

    var deleteAllCandedatesInitQ = function ($g, candidates, decidedNumber) {
        var delHash = candidates.hash - decidedNumber;
        var dellNums = hashMemo[delHash];
        for (var dellNums = hashMemo[delHash], i = 0, len = dellNums.length; i < len; i++) {
            deleteCandidateInitQ($g, candidates, dellNums[i]);
        }
    };

    var deleteCandidateInitQ = function ($g, candidates, deleteNumber) {
        candidates.hash -= deleteNumber;
        candidates.length--;
        $g.countMemo.numsMemo.rows[candidates.cell.i][deleteNumber]--;
        $g.countMemo.numsMemo.cols[candidates.cell.j][deleteNumber]--;
        $g.countMemo.numsMemo.blos[candidates.cell.bi][deleteNumber]--;
    };

    var deleteAllCandedates = function ($g, candidates, decidedNumber, result) {
        var len = candidates.length;
        if (len == 1) {
            if (!decideCandidates($g, candidates.cell.key, decidedNumber, result)) {
                return false;
            } else {
                return true;
            }
        }
        var candidatesNums = hashMemo[candidates.hash];
        for (var idx = 0; idx < len; idx++) {
            var num = candidatesNums[idx];
            if ((candidates.hash & num) && decidedNumber != num) {
                if (candidates.solved) break;
                result.removeCount++;
                if (!deleteCandidate($g, candidates, num, result)) {
                    return false;
                }
            }
        }
        return true;
    };

    var deleteCandidate = function ($g, candidates, delNum, result) {
        candidates.hash -= delNum;
        candidates.length--;
        var row = $g.countMemo.numsMemo.rows[candidates.cell.i];
        row[delNum]--;
        var col = $g.countMemo.numsMemo.cols[candidates.cell.j];
        col[delNum]--;
        var blo = $g.countMemo.numsMemo.blos[candidates.cell.bi];
        blo[delNum]--;

        if (row[delNum] == 0 || col[delNum] == 0 || blo[delNum] == 0) {
            return false;
        }

        if (candidates.hash === 0) return false;

        if (candidates.length === 1)
            if (!decideCandidates($g, candidates.cell.key, candidates.hash, result)) {
                return false;
            }

        if ($g.countMemo.rows[candidates.cell.i][delNum] && row[delNum] == 1) {
            if (!decideSingleNumberInList($g, $g.rows[candidates.cell.i], delNum, result)) {
                return false;
            }
        }
        if ($g.countMemo.cols[candidates.cell.j][delNum] && col[delNum] == 1) {
            if (!decideSingleNumberInList($g, $g.cols[candidates.cell.j], delNum, result)) {
                return false;
            }
        }
        if ($g.countMemo.blos[candidates.cell.bi][delNum] && blo[delNum] == 1) {
            if (!decideSingleNumberInList($g, $g.blos[candidates.cell.bi], delNum, result)) {
                return false;
            }
        }
        if (candidates.length == 2) $g.biValueChainQueue.push(candidates);
        return true;
    };

    var endAsError = function (memoMap) {
        return { result: false, dup: false, invalid: true, msg: "no solution", memoMap: memoMap };
    };

    var decideCandidates = function ($g, key, decidedNumber, result) {
        $g.leftCount--;
        $g.countMemo.numsLeft[decidedNumber]--;
        var candidates = $g.memoMap[key];
        var row = $g.rows[candidates.cell.i];
        var ri = row.indexOf(candidates);
        row.splice(ri, 1);
        var col = $g.cols[candidates.cell.j];
        var ci = col.indexOf(candidates);
        col.splice(ci, 1);
        var blo = $g.blos[candidates.cell.bi];
        var bi = blo.indexOf(candidates);
        blo.splice(bi, 1);
        $g.countMemo.rows[candidates.cell.i][decidedNumber] = false;
        $g.countMemo.cols[candidates.cell.j][decidedNumber] = false;
        $g.countMemo.blos[candidates.cell.bi][decidedNumber] = false;
        candidates.solved = true;
        return removeCandidatesFromList($g, row, decidedNumber, result)
            && removeCandidatesFromList($g, col, decidedNumber, result)
            && removeCandidatesFromList($g, blo, decidedNumber, result);
    };

    var removeCandidatesFromList = function ($g, list, decidedNumber, result) {
        for (var li = 0, llen = list.length; li < llen; li++) {
            var candidates = list[li];
            if (candidates.solved) continue;
            if (candidates.hash & decidedNumber) {
                if (!deleteCandidate($g, candidates, decidedNumber, result)) {
                    return false;
                }
                result.removeCount++;
            }
            if (llen != list.length) {
                li = -1;
                llen = list.length;
            }
        }
        return true;
    };

    var decideSingleNumberInList = function ($g, list, number, result) {
        for (var li = 0, llen = list.length; li < llen; li++) {
            var candidates = list[li];
            if (list[li].hash & number) {
                if (candidates.solved) return true;
                if (!deleteAllCandedates($g, candidates, number, result)) {
                    return false;
                }
                return true;
            }
        }
        return false;
    };

    var removeByGroupInclusive = function ($g, result) {
        for (var gi = 1; gi <= LEN; gi++) {
            if (!removeByGroupInclusiveSub($g, $g.rows[gi], result)) return false;
            if (!removeByGroupInclusiveSub($g, $g.cols[gi], result)) return false;
            if (!removeByGroupInclusiveSub($g, $g.blos[gi], result)) return false;
        }
        return true;
    }

    var removeByGroupInclusiveSub = function ($g, group, result) {
        var glen = group.length;
        if (glen <= 3 || 9 <= glen) return true;

        var len3Members = [];
        for (var i = 0; i < glen; i++) {
            var cnds = group[i];
            if (cnds.length <= 3) len3Members.push(cnds);
        }

        var len = len3Members.length;
        if (len <= 2) return true;
        for (var i1 = 0; i1 < len - 2; i1++) {
            for (var i2 = i1 + 1; i2 < len - 1; i2++) {
                for (var i3 = i2 + 1; i3 < len; i3++) {
                    var c1 = len3Members[i1];
                    var c2 = len3Members[i2];
                    var c3 = len3Members[i3];
                    var nums = hashMemo[(c1.hash | c2.hash | c3.hash)];
                    if (nums.length <= 3) {
                        var otherMembers = [];
                        for (var i = 0; i < glen; i++) {
                            var cnds = group[i];
                            if (cnds !== c1 && cnds !== c2 && cnds !== c3) {
                                otherMembers.push(cnds);
                            }
                        }
                        for (var oi = 0; oi < otherMembers.length; oi++) {
                            var cnds = otherMembers[oi];
                            for (var ni = 0, nlen = nums.length; ni < nlen; ni++) {
                                if (cnds.solved) break;
                                var num = nums[ni];
                                if (!(cnds.hash & num)) continue;
                                result.removeCount++;
                                if (!deleteCandidate($g, cnds, num, result)) return false;
                            }
                        }
                        return true;
                    }
                }
            }
        }
        return true;
    }

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
                    var candidates = blo[mi];
                    if (candidates.hash & num) {
                        numberLeftCells.push(candidates);
                        bloCandidates.push(candidates);
                    }
                }
            }
        }

        var indexes = [];
        var solvedCells = [];
        for (var li = 0, len = numberLeftCells.length; li < len; li++) {
            var target = numberLeftCells[li];
            if (solvedCells.indexOf(target.cell.key) != -1) {
                continue;
            }
            if (!(target.hash & num)) continue;
            if (target.length === 1) continue;
            var bLen = bKeys.length;
            indexes = getAllZeroArray(bLen);
            var pattern = getAllZeroArray(bLen);
            var targetBkeyIndex = bKeys.indexOf(target.cell.bi);
            var occupiedGroups = target.cell.ghash;
            var ghashHistory = [];
            pattern[targetBkeyIndex] = target.cell.key;
            var foundPattern = true;
            for (var bKeyIndex = 0; bKeyIndex < bLen; bKeyIndex++) {
                if (target.cell.bi === bKeys[bKeyIndex]) continue;
                var foundCandidate = false;
                var leftCells = numberLeftBlos[bKeyIndex];
                for (var len = leftCells.length; indexes[bKeyIndex] < len; indexes[bKeyIndex]++) {
                    var subTarget = leftCells[indexes[bKeyIndex]];
                    if (!(occupiedGroups & subTarget.cell.ghash)) {
                        occupiedGroups += subTarget.cell.ghash;
                        ghashHistory.push(subTarget.cell.ghash);
                        pattern[bKeyIndex] = subTarget.cell.key;
                        foundCandidate = true;
                        break;
                    }
                }
                if (foundCandidate) {
                    continue;
                } else {
                    if (bKeyIndex === 0 ||
                        (bKeyIndex === 1 && (indexes[0] + 1 >= numberLeftBlos[0].length || target.cell.bi === bKeys[0]))) {
                        foundPattern = false;
                        break;
                    }
                    indexes[bKeyIndex] = 0;
                    occupiedGroups -= ghashHistory.pop();
                    if (target.cell.bi === bKeys[bKeyIndex - 1]) bKeyIndex--;
                    bKeyIndex -= 2;
                    indexes[bKeyIndex + 1]++;
                }
            }

            if (foundPattern) {
                for (var idx = 0; idx < bLen; idx++) {
                    solvedCells.push(pattern[idx]);
                }
            } else {
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

    var removeByBiValueChain = function ($g, result) {
        while ($g.biValueChainQueue.length) {
            var candidates = $g.biValueChainQueue.pop();
            if (candidates.solved) continue;
            if (candidates.length != 2) continue;
            var biValue = hashMemo[candidates.hash];
            var first = getChainResult($g, candidates, candidates, biValue[0], biValue[1]);
            var second = getChainResult($g, candidates, candidates, biValue[1], biValue[0]);
            if (!removeByChainResult($g, first, second, result)) return false;
        }
        return true;
    };

    var removeByCrossStrongLinkChain = function ($g, result) {
        var nums = hashMemo[511];
        for (var gi = 1; gi <= LEN; gi++) {
            for (var ni = 1; ni <= LEN; ni++) {
                var num = nums[ni];
                if ($g.countMemo.numsMemo.rows[gi][num] == 2 && $g.countMemo.numsMemo.cols[gi][num] == 2)
                    if (!removeByCrossStrongLinkChainSub($g, $g.rows[gi], num, result)) return false;
            }
        }
        return true;
    };

    var removeByCrossStrongLinkChainSub = function ($g, group, num, result) {
        var fcandidates = null;
        var scandidates = null;
        for (var i = 0, len = group.length; i < len; i++) {
            var cnds = group[i];
            if (cnds.hash & num) {
                if (fcandidates) {
                    scandidates = cnds;
                    break;
                } else {
                    fcandidates = cnds;
                }
            }
        }
        if (scandidates) {
            var first = getChainResult($g, fcandidates, scandidates, num, num);
            var second = getChainResult($g, scandidates, fcandidates, num, num);
            if (!removeByChainResult($g, first, second, result)) return false;
        }
        return true;
    }

    var removeByChainResult = function ($g, first, second, result) {
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
                var candidates = $g.memoMap[trkey];
                if (candidates.solved) continue;
                result.removeCount++;
                if (!deleteAllCandedates($g, candidates, trueResult.onKeys[trkey], result)) return false;
            }
            return true;
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
                        var candidates = $g.memoMap[fkey];
                        if (candidates.solved) continue;
                        result.removeCount++;
                        if (!deleteAllCandedates($g, candidates, first.onKeys[fkey], result)) return false;
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
                    var candidates = $g.memoMap[fkey];
                    if (candidates.solved) continue;
                    for (var offi = 0, nums = hashMemo[offNumHash], nlen = nums.length; offi < nlen; offi++) {
                        var num = nums[offi];
                        if (candidates.hash & num) {
                            result.removeCount++;
                            if (!deleteCandidate($g, candidates, num, result)) return false;
                        }
                    }
                }
            }
        }
        return true;
    };

    var getChainResult = function ($g, onCandidates, offCandidates, onNum, offNum) {
        var chainResult = {
            hash: 0,
            onKeys: {},
            offKeys: {},
            onKeysList: [],
            offKeysList: [],
            numsRecords: {},
            offNumsRecord: { rows: {}, cols: {}, blos: {} },
            err: false
        };
        if (!addChainResultOn($g, onCandidates, onNum, chainResult)) {
            chainResult.err = true;
            return chainResult;
        }
        if (!addChainResultOff($g, offCandidates, offNum, chainResult)) {
            chainResult.err = true;
            return chainResult;
        }
        return chainResult;
    };

    var addChainResultOn = function ($g, candidates, onNum, chainResult) {
        if (!addChainResult(chainResult, candidates, onNum)) return false;
        for (var li = 0, row = $g.rows[candidates.cell.i], llen = row.length; li < llen; li++) {
            var rcandidates = row[li];
            if (rcandidates.solved || rcandidates == candidates) continue;
            var key = rcandidates.cell.key;
            if ((rcandidates.hash & onNum)) {
                if (rcandidates.length == 2 && !chainResult.onKeys[key]) {
                    if (!addChainResultOn($g, $g.memoMap[key], rcandidates.hash - onNum, chainResult)) return false;
                }
                if (!addChainResultOff($g, $g.memoMap[key], onNum, chainResult)) return false;
            }
        }
        for (var li = 0, col = $g.cols[candidates.cell.j], llen = col.length; li < llen; li++) {
            var ccandidates = col[li];
            if (ccandidates.solved || ccandidates == candidates) continue;
            var key = ccandidates.cell.key;
            if ((ccandidates.hash & onNum)) {
                if (ccandidates.length == 2 && !chainResult.onKeys[key]) {
                    if (!addChainResultOn($g, $g.memoMap[key], ccandidates.hash - onNum, chainResult)) return false;
                }
                if (!addChainResultOff($g, $g.memoMap[key], onNum, chainResult)) return false;
            }
        }
        for (var li = 0, blo = $g.blos[candidates.cell.bi], llen = blo.length; li < llen; li++) {
            var bcandidates = blo[li];
            if (bcandidates.solved || bcandidates == candidates) continue;
            var key = bcandidates.cell.key;
            if ((bcandidates.hash & onNum)) {
                if (bcandidates.length == 2 && !chainResult.onKeys[key]) {
                    if (!addChainResultOn($g, $g.memoMap[key], bcandidates.hash - onNum, chainResult)) return false;
                }
                if (!addChainResultOff($g, $g.memoMap[key], onNum, chainResult)) return false;
            }
        }
        return true;
    };

    var addChainResultOff = function ($g, cnds, offNum, chainResult, excludeGroup) {
        var key = cnds.cell.key;
        if (!chainResult.offKeys[key]) {
            chainResult.offKeys[key] = offNum;
            chainResult.offKeysList.push(key);
        } else {
            if ((chainResult.offKeys[key] & offNum)) return true;
            chainResult.offKeys[key] += offNum;
            var leftNums = cnds.hash - chainResult.offKeys[key];
            if (leftNums == 0) return false;
            if (hashLengthMemo[leftNums] == 1) {
                if (chainResult.onKeys[key]) {
                    if (chainResult.onKeys[key] != leftNums) return false;
                } else {
                    if (!addChainResultOn($g, cnds, leftNums, chainResult)) return false;
                }
            }
        }
        if (excludeGroup !== 0) {
            if (!addChainResultOffGroups($g, $g.rows[cnds.cell.i], cnds, offNum, $g.countMemo.numsMemo.rows[cnds.cell.i], chainResult, 0)) return false;
        }
        if (excludeGroup !== 1) {
            if (!addChainResultOffGroups($g, $g.cols[cnds.cell.j], cnds, offNum, $g.countMemo.numsMemo.cols[cnds.cell.j], chainResult, 1)) return false;
        }
        if (excludeGroup !== 2) {
            if (!addChainResultOffGroups($g, $g.blos[cnds.cell.bi], cnds, offNum, $g.countMemo.numsMemo.blos[cnds.cell.bi], chainResult, 2)) return false;
        }
        return true;
    };

    var addChainResultOffGroups = function ($g, group, candidates, offNum, numsMemo, chainResult, groupId) {
        if (numsMemo[offNum] == 2) {
            for (var gi = 0, glen = group.length; gi < glen; gi++) {
                var gcandidates = group[gi];
                var key = gcandidates.cell.key;
                if (key === candidates.cell.key) continue;
                if ((gcandidates.hash & offNum) && !chainResult.onKeys[key]) {
                    if (!addChainResultOn($g, $g.memoMap[key], offNum, chainResult)) return false;
                    for (var offNums = hashMemo[gcandidates.hash - offNum], ofni = 0, ofnlen = offNums.length; ofni < ofnlen; ofni++) {
                        if (!addChainResultOff($g, $g.memoMap[key], offNums[ofni], chainResult, groupId)) return false;
                    }
                    break;
                }
            }
        }
        return true;
    };

    var addChainResult = function (chainResult, candidates, num) {
        chainResult.hash |= num;
        chainResult.onKeys[candidates.cell.key] = num;
        chainResult.onKeysList.push(candidates.cell.key);
        if (!chainResult.numsRecords[num]) chainResult.numsRecords[num] = 0;
        var numRecords = chainResult.numsRecords[num];
        if (numRecords & candidates.cell.ghash) {
            return false;
        }
        chainResult.numsRecords[num] |= candidates.cell.ghash;
        return true;
    };

    var validateMemoMap = function (memoMap) {
        var rows = {};
        var cols = {};
        var blos = {};

        for (var cli = 0, len = allCells.length; cli < len; cli++) {
            var cell = allCells[cli];

            var candidates = memoMap[cell.key];
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
            var cellName = temporary.cell.key;
            newMemoMap[cellName] = createCandidates(temporary.num, 1, temporary.cell);
            q[temporary.cell.i - 1][temporary.cell.j - 1] = temporary.num;
        }
        return [q, newMemoMap];
    };

    var copyMemoMap = function (memoMap) {
        var newMemoMap = {};
        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
                var memo = memoMap[cellNames[i][j]];
                newMemoMap[cellNames[i][j]] = createCandidates(memo.hash, memo.length, memo.cell);
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