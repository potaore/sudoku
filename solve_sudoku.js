var exports = exports;
if (!exports) exports = {};
var solver = exports;
(function () {
    var version = "1.5.0";
    var pf;
    (function () {
        pf = {
            start: process.hrtime,
            end: function (start) {
                diff = process.hrtime(start);
                return diff[0] * 1e9 + diff[1];
            },
            calcPerMs: function (num, nano) {
                return num * 1000000 / nano;
            }
        };
        /*
        pf = {
            start: function () { return performance.now(); },
            end: function (start) {
                return performance.now() - start;
            },
            calcPerMs: function (num, ms) {
                return num * ms;
            }
        };
        */
    })();

    var LEN = 9;
    var NUMS;
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
        NUMS = hashMemo[511];

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
                nakedTriplet: 0,
                hiddenPair: 0,
                hiddenTriplet: 0,
                intersection: 0,
                singleNumberChain: 0,
                xyzWing: 0
            },
            cost: {
                singleNumberPattern: 0,
                biValueChain: 0,
                nakedTriplet: 0,
                hiddenPair: 0,
                hiddenTriplet: 0,
                intersection: 0,
                singleNumberChain: 0,
                xyzWing: 0
            },
            removeCountPerMs: {
                singleNumberPattern: 0,
                biValueChain: 0,
                nakedTriplet: 0,
                hiddenPair: 0,
                hiddenTriplet: 0,
                intersection: 0,
                singleNumberChain: 0,
                xyzWing: 0
            }
        };
    };

    var infomations = getNewInfomations();

    var clearInfomations = function () {
        infomations = getNewInfomations();
    };

    var getInfomations = function () {
        var f = infomations;
        f.removeCountPerMs.singleNumberPattern = pf.calcPerMs(f.removeCount.singleNumberPattern, f.cost.singleNumberPattern);
        f.removeCountPerMs.biValueChain = pf.calcPerMs(f.removeCount.biValueChain, f.cost.biValueChain);
        f.removeCountPerMs.nakedTriplet = pf.calcPerMs(f.removeCount.nakedTriplet, f.cost.nakedTriplet);
        f.removeCountPerMs.hiddenPair = pf.calcPerMs(f.removeCount.hiddenPair, f.cost.hiddenPair);
        f.removeCountPerMs.hiddenTriplet = pf.calcPerMs(f.removeCount.hiddenTriplet, f.cost.hiddenTriplet);
        f.removeCountPerMs.intersection = pf.calcPerMs(f.removeCount.intersection, f.cost.intersection);
        f.removeCountPerMs.singleNumberChain = pf.calcPerMs(f.removeCount.singleNumberChain, f.cost.singleNumberChain);
        f.removeCountPerMs.xyzWing = pf.calcPerMs(f.removeCount.xyzWing, f.cost.xyzWing);
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

        initQuestion(memoMap, $g, useMemoMap);

        var removeCount = 0;
        var result = { removeCount: 0 };
        var solved = false;

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
        var start = null;
        while (!solved) {
            if ($g.leftCount >= 75) break;
            removeCount = 0;
            result.removeCount = 0;

            start = pf.start();
            if (!removeByHiddenPair($g, result)) return endAsError(memoMap);
            infomations.cost.hiddenPair += pf.end(start);
            removeCount += result.removeCount;
            infomations.removeCount.hiddenPair += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }

            start = pf.start();
            if (!removeByHiddenTriplet($g, result)) return endAsError(memoMap);
            infomations.cost.hiddenTriplet += pf.end(start);
            removeCount += result.removeCount;
            infomations.removeCount.hiddenTriplet += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }
            
            start = pf.start();
            if (!removeByIntersection($g, result)) return endAsError(memoMap);
            infomations.cost.intersection += pf.end(start);
            removeCount += result.removeCount;
            infomations.removeCount.intersection += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }

            if ($g.leftCount >= 65) break;

            start = pf.start();
            if (!removeByNakedTriplet($g, result)) return endAsError(memoMap);
            infomations.cost.nakedTriplet += pf.end(start);
            removeCount += result.removeCount;
            infomations.removeCount.nakedTriplet += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }

            start = pf.start();
            if (!removeByXyzWing($g, result)) return endAsError(memoMap);
            infomations.cost.xyzWing += pf.end(start);
            removeCount += result.removeCount;
            infomations.removeCount.xyzWing += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }

            start = pf.start();
            if (!removeBySingleNumberChain($g, result)) return endAsError(memoMap);
            infomations.cost.singleNumberChain += pf.end(start);
            removeCount += result.removeCount;
            infomations.removeCount.singleNumberChain += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }

            start = pf.start();
            if (!removeByBiValueChain($g, result)) return endAsError(memoMap);
            infomations.cost.biValueChain += pf.end(start);
            removeCount += result.removeCount;
            infomations.removeCount.biValueChain += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }

            start = pf.start();
            if (!removeBySingleNumberPattern($g, result)) return endAsError(memoMap);
            infomations.cost.singleNumberPattern += pf.end(start);
            removeCount += result.removeCount;
            infomations.removeCount.singleNumberPattern += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }

            if (removeCount == 0) break;
        }

        if ($g.leftCount === 0) {
            if (validateMemoMap(memoMap)) {
                return { result: true, dup: false, invalid: false, msg: "solved", memoMap: memoMap, countMemo: $g.countMemo };
            } else {
                return endAsError(memoMap);
            }
        } else {
            var useDoubleTemporary = false;
            if (50 <= $g.leftCount && $g.leftCount <= 64) {
                var leftCount = 0;
                var nlist = NUMS;
                for (var ii = 1; ii <= LEN; ii++)
                    for (var jj = 0; jj < LEN; jj++)
                        leftCount += $g.countMemo.numsMemo.rows[ii][nlist[jj]];
                useDoubleTemporary = leftCount >= 245;
            }

            var patterns = [];
            var minNum = 100;
            var candidates = null;
            if (useDoubleTemporary) {
                var mlCnd1 = null;
                var mlCnd2 = null;
                for (var ai = 0, alen = allCells.length; ai < alen; ai++) {
                    candidates = $g.memoMap[allCells[ai].key];
                    if (candidates.solved) continue;
                    if (!mlCnd1) {
                        mlCnd1 = candidates;
                        continue;
                    }
                    var num = candidates.length;
                    if (num < minNum) {
                        minNum = num;
                        mlCnd2 = mlCnd1;
                        mlCnd1 = candidates;
                    } else if (num == minNum) {
                        mlCnd2 = candidates;
                    }
                }

                var nums1 = hashMemo[mlCnd1.hash];
                var nums2 = hashMemo[mlCnd2.hash];
                for (var ni1 = 0, nlen1 = nums1.length; ni1 < nlen1; ni1++) {
                    for (var ni2 = 0, nlen2 = nums2.length; ni2 < nlen2; ni2++) {
                        if (nums1[ni1] == nums2[ni2] && (mlCnd1.cell.ghash & mlCnd2.cell.ghash)) continue;
                        patterns.push([
                            { cell: mlCnd1.cell, num: nums1[ni1] },
                            { cell: mlCnd2.cell, num: nums2[ni2] },
                        ]);
                    }
                }
            } else {
                var mlCnd = null;
                for (var ai = 0, alen = allCells.length; ai < alen; ai++) {
                    candidates = $g.memoMap[allCells[ai].key];
                    if (candidates.solved) continue;
                    var num = candidates.length;
                    if (num < minNum) {
                        minNum = num;
                        mlCnd = candidates;
                        if (num == 2) break;
                    }
                }
                var nums = hashMemo[mlCnd.hash];
                for (var ni = 0, nlen = nums.length; ni < nlen; ni++)
                    patterns.push([{ cell: mlCnd.cell, num: nums[ni] }]);
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
        return endAsError(memoMap);
    };

    var initQuestion = function (memoMap, $g, useMemoMap) {
        var rowsNumsMemo = $g.countMemo.numsMemo.rows;
        var colsNumsMemo = $g.countMemo.numsMemo.cols;
        var blosNumsMemo = $g.countMemo.numsMemo.blos;
        var nums = NUMS;
        for (var listIndex = 1; listIndex <= LEN; listIndex++) {
            var rowMemo = rowsNumsMemo[listIndex] = {};
            var colMemo = colsNumsMemo[listIndex] = {};
            var bloMemo = blosNumsMemo[listIndex] = {};

            if (useMemoMap) {
                for (var ni = 0; ni < LEN; ni++) {
                    var hash = nums[ni];
                    rowMemo[hash] = 0;
                    colMemo[hash] = 0;
                    bloMemo[hash] = 0;
                }
            } else {
                for (var ni = 0; ni < LEN; ni++) {
                    var hash = nums[ni];
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
        for (var i = 0, len = allCells.length; i < len; i++) {
            var cell = allCells[i];
            memoMap[cell.key] = createCandidates(511, 9, cell);
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
            return decideCandidates($g, candidates.cell.key, decidedNumber, result);
        }

        var candidatesNums = hashMemo[candidates.hash];
        for (var idx = 0; idx < len; idx++) {
            var num = candidatesNums[idx];
            if ((candidates.hash & num) && decidedNumber != num) {
                if (candidates.solved) break;
                if (!deleteCandidate($g, candidates, num, result)) {
                    return false;
                }
            }
        }
        return true;
    };

    var deleteCandidate = function ($g, candidates, delNum, result) {
        result.removeCount++;
        candidates.hash -= delNum;
        candidates.length--;
        var row = $g.countMemo.numsMemo.rows[candidates.cell.i];
        row[delNum]--;
        var col = $g.countMemo.numsMemo.cols[candidates.cell.j];
        col[delNum]--;
        var blo = $g.countMemo.numsMemo.blos[candidates.cell.bi];
        blo[delNum]--;

        if (row[delNum] == 0 || col[delNum] == 0 || blo[delNum] == 0) return false;
        if (candidates.hash === 0) return false;
        if (candidates.length === 1)
            if (!decideCandidates($g, candidates.cell.key, candidates.hash, result)) return false;

        if ($g.countMemo.rows[candidates.cell.i][delNum] && row[delNum] == 1)
            if (!decideSingleNumberInList($g, $g.rows[candidates.cell.i], delNum, result)) return false;

        if ($g.countMemo.cols[candidates.cell.j][delNum] && col[delNum] == 1)
            if (!decideSingleNumberInList($g, $g.cols[candidates.cell.j], delNum, result)) return false;

        if ($g.countMemo.blos[candidates.cell.bi][delNum] && blo[delNum] == 1)
            if (!decideSingleNumberInList($g, $g.blos[candidates.cell.bi], delNum, result)) return false;

        if (candidates.length == 2) $g.biValueChainQueue.push(candidates);
        return true;
    };

    var endAsError = function (memoMap) {
        return { result: false, dup: false, invalid: true, msg: "no solution", memoMap: memoMap, countMemo: null };
    };

    var decideCandidates = function ($g, key, decidedNumber, result) {
        $g.leftCount--;
        $g.countMemo.numsLeft[decidedNumber]--;
        var candidates = $g.memoMap[key];
        var cell = candidates.cell;
        var row = $g.rows[cell.i];
        var ri = row.indexOf(candidates);
        row.splice(ri, 1);
        var col = $g.cols[cell.j];
        var ci = col.indexOf(candidates);
        col.splice(ci, 1);
        var blo = $g.blos[cell.bi];
        var bi = blo.indexOf(candidates);
        blo.splice(bi, 1);
        $g.countMemo.rows[cell.i][decidedNumber] = false;
        $g.countMemo.cols[cell.j][decidedNumber] = false;
        $g.countMemo.blos[cell.bi][decidedNumber] = false;
        candidates.solved = true;
        return removeCandidatesFromList($g, row, decidedNumber, result)
            && removeCandidatesFromList($g, col, decidedNumber, result)
            && removeCandidatesFromList($g, blo, decidedNumber, result);
    };

    var removeCandidatesFromList = function ($g, list, decidedNumber, result) {
        for (var li = 0, llen = list.length; li < llen; li++) {
            var candidates = list[li];
            if (candidates.hash & decidedNumber) {
                if (!deleteCandidate($g, candidates, decidedNumber, result)) return false;
                if (llen != list.length) {
                    li = -1;
                    llen = list.length;
                }
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

    var removeByNakedTriplet = function ($g, result) {
        for (var gi = 1; gi <= LEN; gi++) {
            if (!removeByNakedTripletSub($g, $g.rows[gi], result)) return false;
            if (!removeByNakedTripletSub($g, $g.cols[gi], result)) return false;
            if (!removeByNakedTripletSub($g, $g.blos[gi], result)) return false;
        }
        return true;
    }

    var removeByNakedTripletSub = function ($g, group, result) {
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
            var c1 = len3Members[i1];
            for (var i2 = i1 + 1; i2 < len - 1; i2++) {
                var c2 = len3Members[i2];
                if (hashLengthMemo[(c1.hash | c2.hash)] > 3) continue;
                for (var i3 = i2 + 1; i3 < len; i3++) {
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
                                if (!deleteCandidate($g, cnds, num, result)) return false;
                            }
                        }
                        return true;
                    }
                }
            }
        }
        return true;
    };

    var removeBySingleNumberPattern = function ($g, result) {
        for (var idx = 0; idx < LEN; idx++) {
            var num = 1 << idx;
            if (!removeBySingleNumberPatternSub($g, num, result)) return false;
        }
        return true;
    };

    var removeBySingleNumberPatternSub = function ($g, num, result) {
        if ($g.countMemo.numsLeft[num] < 2 || $g.countMemo.numsLeft[num] == 9) return true;
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

        var blen = bKeys.length;
        var indexes = getAllZeroArray(blen);
        var currrentBkey = 0;
        for (var li = 0, len = numberLeftCells.length; li < len; li++) {
            var target = numberLeftCells[li];
            if (!(target.hash & num)) continue;
            if (target.solved) continue;
            setArrayAllZero(indexes, blen);
            currrentBkey = target.cell.bi;
            var occupiedGroups = target.cell.ghash;
            var ghashHistory = [];
            var foundPattern = true;
            for (var bKeyIndex = 0; bKeyIndex < blen; bKeyIndex++) {
                if (currrentBkey === bKeys[bKeyIndex]) continue;
                var foundCandidate = false;
                var bloCells = numberLeftBlos[bKeyIndex];
                for (var len = bloCells.length; indexes[bKeyIndex] < len; indexes[bKeyIndex]++) {
                    var subTarget = bloCells[indexes[bKeyIndex]];
                    if (!(occupiedGroups & subTarget.cell.ghash)) {
                        occupiedGroups += subTarget.cell.ghash;
                        ghashHistory.push(subTarget.cell.ghash);
                        foundCandidate = true;
                        break;
                    }
                }
                if (foundCandidate) {
                    continue;
                } else {
                    if (bKeyIndex === 0 ||
                        (bKeyIndex === 1 && (indexes[0] + 1 >= numberLeftBlos[0].length || currrentBkey === bKeys[0]))) {
                        foundPattern = false;
                        break;
                    }
                    indexes[bKeyIndex] = 0;
                    occupiedGroups -= ghashHistory.pop();
                    if (currrentBkey === bKeys[bKeyIndex - 1]) bKeyIndex--;
                    bKeyIndex -= 2;
                    indexes[bKeyIndex + 1]++;
                }
            }

            if (foundPattern) {
            } else {
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

    var setArrayAllZero = function (array, len) {
        for (var i = 0; i < len; i++) array[i] = 0;
    };

    var removeByBiValueChain = function ($g, result) {
        while ($g.biValueChainQueue.length) {
            var candidates = $g.biValueChainQueue.pop();
            if (candidates.solved) continue;
            var biValue = hashMemo[candidates.hash];
            var first = getChainResult($g, candidates, candidates, biValue[0], biValue[1]);
            var second = getChainResult($g, candidates, candidates, biValue[1], biValue[0]);
            if (!removeByChainResult($g, first, second, result)) return false;
        }
        return true;
    };

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
                if (!deleteAllCandedates($g, candidates, trueResult.onKeys[trkey], result)) return false;
            }
            return true;
        }

        var fkeys = first.onKeysList;
        var skeys = second.onKeysList;
        for (var fi = 0, flen = fkeys.length; fi < flen; fi++) {
            var fkey = fkeys[fi];
            for (var si = 0, slen = skeys.length; si < slen; si++) {
                var skey = skeys[si];
                if (fkey == skey && first.onKeys[fkey] == second.onKeys[skey]) {
                    var candidates = $g.memoMap[fkey];
                    if (candidates.solved) continue;
                    if (!deleteAllCandedates($g, candidates, first.onKeys[fkey], result)) return false;
                }
            }
        }

        var fkeys = first.offKeysList;
        var skeys = second.offKeysList;
        for (var fi = 0, flen = fkeys.length; fi < flen; fi++) {
            var fkey = fkeys[fi];
            var candidates = $g.memoMap[fkey];
            if (candidates.solved) continue;
            for (var si = 0, slen = skeys.length; si < slen; si++) {
                var skey = skeys[si];
                var offNumHash;
                if (fkey == skey && (offNumHash = first.offKeys[fkey] & second.offKeys[skey])) {
                    for (var offi = 0, nums = hashMemo[offNumHash], nlen = nums.length; offi < nlen; offi++) {
                        var num = nums[offi];
                        if (candidates.hash & num) {
                            if (!deleteCandidate($g, candidates, num, result)) return false;
                        }
                    }
                }
            }
        }
        return true;
    };

    var getNumsRecords;
    var getOffNumsRecord;
    (function () {
        var numsRecords = {};
        var offNumsRecord = {
            rows: {},
            cols: {},
            blos: {}
        };
        var getNumsMemo = function () {
            return { 1: 0, 2: 0, 4: 0, 8: 0, 16: 0, 32: 0, 64: 0, 128: 0, 256: 0 };
        };

        for (var gi = 1; gi <= LEN; gi++) {
            offNumsRecord.rows[gi] = getNumsMemo();
            offNumsRecord.cols[gi] = getNumsMemo();
            offNumsRecord.blos[gi] = getNumsMemo();
        }
        getOffNumsRecord = function () {
            for (var gi = 1; gi <= LEN; gi++) {
                for (var ni = 0, nums = NUMS, nlen = LEN; ni < nlen; ni++) {
                    var num = nums[ni];
                    offNumsRecord.rows[gi][num] = 0;
                    offNumsRecord.cols[gi][num] = 0;
                    offNumsRecord.blos[gi][num] = 0;
                }
            }
            return offNumsRecord;
        };
        getNumsRecords = function () {
            for (var ni = 0, nums = NUMS, nlen = LEN; ni < nlen; ni++) {
                var num = nums[ni];
                numsRecords[num] = 0;
                numsRecords[num] = 0;
                numsRecords[num] = 0;
            }
            return numsRecords;
        };
    })();

    var getChainResult = function ($g, onCandidates, offCandidates, onNum, offNum) {
        var chainResult = {
            onKeys: {},
            offKeys: {},
            onKeysList: [],
            offKeysList: [],
            numsRecords: getNumsRecords(),
            offNumsRecord: getOffNumsRecord(),
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
        if (!propagateAddChainResultOn($g, candidates, $g.rows[candidates.cell.i], onNum, chainResult)) return false;
        if (!propagateAddChainResultOn($g, candidates, $g.cols[candidates.cell.j], onNum, chainResult)) return false;
        if (!propagateAddChainResultOn($g, candidates, $g.blos[candidates.cell.bi], onNum, chainResult)) return false;
        return true;
    };

    var propagateAddChainResultOn = function ($g, candidates, group, onNum, chainResult) {
        for (var gi = 0, glen = group.length; gi < glen; gi++) {
            var gcnd = group[gi];
            if (gcnd == candidates) continue;
            var key = gcnd.cell.key;
            if (gcnd.hash & onNum) {
                if (gcnd.length == 2 && !chainResult.onKeys[key]) {
                    if (!addChainResultOn($g, $g.memoMap[key], gcnd.hash - onNum, chainResult)) return false;
                }
                if (!addChainResultOff($g, $g.memoMap[key], onNum, chainResult)) return false;
            }
        }
        return true;
    };

    var addChainResultOff = function ($g, cnds, offNum, chainResult) {
        var key = cnds.cell.key;
        if (!chainResult.offKeys[key]) {
            chainResult.offKeys[key] = offNum;
            chainResult.offKeysList.push(key);
        } else {
            if (chainResult.offKeys[key] & offNum) return true;
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
        var N = chainResult.offNumsRecord;
        var nMemo = $g.countMemo.numsMemo;

        var i = cnds.cell.i;
        N.rows[i][offNum]++;
        if (!addChainResultOffGroups($g, $g.rows[i], offNum, nMemo.rows[i], N.rows[i][offNum], chainResult)) return false;

        var j = cnds.cell.j;
        N.cols[j][offNum]++;
        if (!addChainResultOffGroups($g, $g.cols[j], offNum, nMemo.cols[j], N.cols[j][offNum], chainResult)) return false;

        var bi = cnds.cell.bi;
        N.blos[bi][offNum]++;
        if (!addChainResultOffGroups($g, $g.blos[bi], offNum, nMemo.blos[bi], N.blos[bi][offNum], chainResult)) return false;

        return true;
    };

    var addChainResultOffGroups = function ($g, group, offNum, numsMemo, offCount, chainResult) {
        if (numsMemo[offNum] - offCount == 1) {
            for (var gi = 0, glen = group.length; gi < glen; gi++) {
                var gcnds = group[gi];
                var key = gcnds.cell.key;
                if (chainResult.offKeys[key] & offNum) continue;
                if (gcnds.hash & offNum) {
                    if (!chainResult.onKeys[key]) {
                        if (!addChainResultOn($g, $g.memoMap[key], offNum, chainResult)) return false;
                        for (var offNums = hashMemo[gcnds.hash - offNum], ofni = 0, ofnlen = offNums.length; ofni < ofnlen; ofni++) {
                            if (!addChainResultOff($g, $g.memoMap[key], offNums[ofni], chainResult)) return false;
                        }
                        break;
                    } else if (chainResult.onKeys[key] && chainResult.onKeys[key] !== offNum) {
                        return false;
                    }
                }
            }
        }
        return true;
    };

    var addChainResult = function (chainResult, candidates, num) {
        chainResult.onKeys[candidates.cell.key] = num;
        chainResult.onKeysList.push(candidates.cell.key);
        if (chainResult.numsRecords[num] & candidates.cell.ghash) return false;
        chainResult.numsRecords[num] |= candidates.cell.ghash;
        return true;
    };

    var removeByHiddenPair = function ($g, result) {
        for (var gi = 1; gi <= LEN; gi++) {
            if (!removeByHiddenPairSub($g, $g.rows[gi], $g.countMemo.numsMemo.rows[gi], result)) return false;
            if (!removeByHiddenPairSub($g, $g.cols[gi], $g.countMemo.numsMemo.cols[gi], result)) return false;
            if (!removeByHiddenPairSub($g, $g.blos[gi], $g.countMemo.numsMemo.blos[gi], result)) return false;
        }
        return true;
    }

    var removeByHiddenPairSub = function ($g, group, numsMemo, result) {
        var glen = group.length;
        if (glen <= 2) return true;
        var pairNumsCollectionHash = 0;
        for (var ni = 0, nums = NUMS, nlen = LEN; ni < nlen; ni++) {
            var num = nums[ni];
            if (numsMemo[num] == 2) pairNumsCollectionHash += num;
        }
        var pnclen = hashLengthMemo[pairNumsCollectionHash];
        if (pnclen < 2) return true;
        var pairNums = hashMemo[pairNumsCollectionHash];
        for (var n1i = 0, n1len = pnclen - 1; n1i < n1len; n1i++) {
            var n1 = pairNums[n1i];
            for (var n2i = n1i + 1; n2i < pnclen; n2i++) {
                var n2 = pairNums[n2i];
                var pairNumsHash = n1 + n2;
                var fcnds = null;
                var scnds = null;
                for (var i = 0; i < glen; i++) {
                    var cnds = group[i];
                    if ((cnds.hash & pairNumsHash) == pairNumsHash) {
                        if (fcnds) {
                            scnds = cnds;
                            break;
                        } else {
                            fcnds = cnds;
                        }
                    }
                }
                if (!scnds) continue;
                var fDelNums = hashMemo[fcnds.hash - pairNumsHash];
                for (var i = 0, len = fDelNums.length; i < len; i++) {
                    if (fcnds.solved) break;
                    var delNum = fDelNums[i];
                    if (fcnds.hash & delNum) {
                        if (!deleteCandidate($g, fcnds, delNum, result)) return false;
                    }
                }
                var sDelNums = hashMemo[scnds.hash - (scnds.hash & pairNumsHash)];
                for (var i = 0, len = sDelNums.length; i < len; i++) {
                    if (scnds.solved) break;
                    var delNum = sDelNums[i];
                    if (scnds.hash & delNum) {
                        if (!deleteCandidate($g, scnds, delNum, result)) return false;
                    }
                }
                return true;
            }
        }
        return true;
    };

    var removeByHiddenTriplet = function ($g, result) {
        for (var gi = 1; gi <= LEN; gi++) {
            if (!removeByHiddenTripletSub($g, $g.rows[gi], $g.countMemo.numsMemo.rows[gi], result)) return false;
            if (!removeByHiddenTripletSub($g, $g.cols[gi], $g.countMemo.numsMemo.cols[gi], result)) return false;
            if (!removeByHiddenTripletSub($g, $g.blos[gi], $g.countMemo.numsMemo.blos[gi], result)) return false;
        }
        return true;
    }

    var removeByHiddenTripletSub = function ($g, group, numsMemo, result) {
        var glen = group.length;
        if (glen <= 3) return true;
        var triNumsCollectionHash = 0;
        for (var ni = 0, nums = NUMS, nlen = LEN; ni < nlen; ni++) {
            var num = nums[ni];
            if (numsMemo[num] == 2 || numsMemo[num] == 3) triNumsCollectionHash += num;
        }
        var tnclen = hashLengthMemo[triNumsCollectionHash];
        if (tnclen < 3) return true;
        var triNums = hashMemo[triNumsCollectionHash];
        for (var n1i = 0, n1len = tnclen - 2; n1i < n1len; n1i++) {
            var n1 = triNums[n1i];
            for (var n2i = n1i + 1; n2i < tnclen - 1; n2i++) {
                var n2 = triNums[n2i];
                for (var n3i = n2i + 1; n3i < tnclen; n3i++) {
                    var n3 = triNums[n3i];
                    var triNumsHash = n1 + n2 + n3;
                    var fcnds = null;
                    var scnds = null;
                    var tcnds = null;
                    for (var i = 0; i < glen; i++) {
                        var cnds = group[i];
                        var matchLen = hashLengthMemo[(cnds.hash & triNumsHash)];
                        if (matchLen) {
                            if(tcnds) {
                                tcnds = null;
                                break;
                            } else if (scnds) {
                                tcnds = cnds;
                            } else if (fcnds) {
                                scnds = cnds;
                            } else {
                                fcnds = cnds;
                            }
                        }
                    }
                    if (!tcnds) continue;
                    var fDelNums = hashMemo[fcnds.hash - (fcnds.hash & triNumsHash)];
                    for (var i = 0, len = fDelNums.length; i < len; i++) {
                        var delNum = fDelNums[i];
                        if (fcnds.hash & delNum) {
                            if (!deleteCandidate($g, fcnds, delNum, result)) return false;
                        }
                    }
                    var sDelNums = hashMemo[scnds.hash - (scnds.hash & triNumsHash)];
                    for (var i = 0, len = sDelNums.length; i < len; i++) {
                        var delNum = sDelNums[i];
                        if (scnds.hash & delNum) {
                            if (!deleteCandidate($g, scnds, delNum, result)) return false;
                        }
                    }
                    var tDelNums = hashMemo[tcnds.hash - (tcnds.hash & triNumsHash)];
                    for (var i = 0, len = tDelNums.length; i < len; i++) {
                        var delNum = tDelNums[i];
                        if (tcnds.hash & delNum) {
                            if (!deleteCandidate($g, tcnds, delNum, result)) return false;
                        }
                    }
                    return true;
                }
            }
        }
        return true;
    };

    var removeByIntersection = function ($g, result) {
        var nums = NUMS, nlen = LEN;
        var nMemo = $g.countMemo.numsMemo;
        for (var gi = 1; gi <= LEN; gi++) {
            var rowsMemo = $g.countMemo.numsMemo.rows[gi];
            var colsMemo = $g.countMemo.numsMemo.cols[gi];
            var blosMemo = $g.countMemo.numsMemo.blos[gi];
            for (var ni = 0; ni < nlen; ni++) {
                var num = nums[ni];
                if (rowsMemo[num] == 2 || rowsMemo[num] == 3)
                    if (!removeByIntersectionSub($g, $g.rows[gi], gi, "i", "bi", num, rowsMemo[num], $g.blos, nMemo.blos, result)) return false;
                if (colsMemo[num] == 2 || colsMemo[num] == 3)
                    if (!removeByIntersectionSub($g, $g.cols[gi], gi, "j", "bi", num, colsMemo[num], $g.blos, nMemo.blos, result)) return false;
                //if (blosMemo[num] == 2 || blosMemo[num] == 3) {
                //    if (!removeByIntersectionSub($g, $g.blos[gi], gi, "bi", "i", num, blosMemo[num], $g.rows, nMemo.rows, result)) return false;
                //    if (!removeByIntersectionSub($g, $g.blos[gi], gi, "bi", "j", num, blosMemo[num], $g.cols, nMemo.cols, result)) return false;
                //}
            }
        }
        return true;
    };

    var removeByIntersectionSub = function ($g, group, gi, gKey, tgKey, num, numCount, tGroups, tGroupMemo, result) {
        var tgi = 0;
        for (var i = 0, glen = group.length; i < glen; i++) {
            var cnds = group[i];
            if (cnds.hash & num) {
                if (tgi) {
                    if (tgi !== cnds.cell[tgKey]) return true;
                } else {
                    tgi = cnds.cell[tgKey];
                }
            }
        }
        if (!tgi) return true;
        if (tGroupMemo[tgi][num] == numCount) return true;

        var tGroup = tGroups[tgi];
        for (var i = 0, tglen = tGroup.length; i < tglen; i++) {
            var cnds = tGroup[i];
            if (cnds.cell[gKey] != gi && (cnds.hash & num)) {
                if (!deleteCandidate($g, cnds, num, result)) return false;
                if (tglen != tGroup.length) {
                    i = -1;
                    tglen = tGroup.length;
                }
            }
        }
        return true;
    };

    var removeBySingleNumberChain = function ($g, result) {
        var nums = NUMS;
        var nlen = LEN;
        for (var ni = 0; ni < nlen; ni++) {
            var num = nums[ni];
            for (var gi = 1; gi <= LEN; gi++) {
                var rowMemo = $g.countMemo.numsMemo.rows[gi];
                if (rowMemo[num] == 2) {
                    if (!removeBySingleNumberChainSub($g, $g.rows[gi], num, result)) return false;
                    break;
                }
            }
        }
        for (var ni = 0; ni < nlen; ni++) {
            var num = nums[ni];
            for (var gi = 1; gi <= LEN; gi++) {
                var colMemo = $g.countMemo.numsMemo.cols[gi];
                if (colMemo[num] == 2) {
                    if (!removeBySingleNumberChainSub($g, $g.cols[gi], num, result)) return false;
                    break;
                }
            }
        }
        //for (var ni = 0; ni < nlen; ni++) {
        //    var num = nums[ni];
        //    for (var gi = 1; gi <= LEN; gi++) {
        //        var bloMemo = $g.countMemo.numsMemo.blos[gi];
        //        if (bloMemo[num] == 2) {
        //            if (!removeBySingleNumberChainSub($g, $g.blos[gi], num, result)) return false;
        //            break;
        //        }
        //    }
        //}
        return true;
    };

    var removeBySingleNumberChainSub = function ($g, group, num, result) {
        var fcnds = null;
        var scnds = null;
        for (var i = 0, len = group.length; i < len; i++) {
            var cnds = group[i];
            if (cnds.hash & num) {
                if (fcnds) {
                    scnds = cnds;
                    break;
                } else {
                    fcnds = cnds;
                }
            }
        }
        if (!scnds) {
            return true;
        }

        var first = getSingleNumberChainResult($g, fcnds, scnds, num, result);
        var second = getSingleNumberChainResult($g, scnds, fcnds, num, result);
        if (first.err && second.err) return false;
        var trueResult = null;
        if (first.err) {
            trueResult = second;
        } else if (second.err) {
            trueResult = first;
        }

        if (trueResult) {
            for (var ti = 0, tlen = trueResult.onCndsList.length; ti < tlen; ti++) {
                var tcnds = trueResult.onCndsList[ti];
                if (tcnds.solved) continue;
                if (!deleteAllCandedates($g, tcnds, num, result)) return false;
            }
            return true;
        }

        for (var fi = 0, flen = first.onCndsList.length; fi < flen; fi++) {
            var fcnds = first.onCndsList[fi];
            if (fcnds.solved) continue;
            for (var si = 0, slen = second.onCndsList.length; si < slen; si++) {
                var scnds = second.onCndsList[si];
                if (fcnds == scnds) {
                    if (!deleteAllCandedates($g, fcnds, num, result)) return false;
                }
            }
        }

        for (var fi = 0, flen = first.offCndsList.length; fi < flen; fi++) {
            var fcnds = first.offCndsList[fi];
            if (fcnds.solved) continue;
            if (!(fcnds.hash & num)) continue;
            for (var si = 0, slen = second.offCndsList.length; si < slen; si++) {
                var scnds = second.offCndsList[si];
                if (fcnds == scnds) {
                    if (!deleteCandidate($g, fcnds, num, result)) return false;
                }
            }
        }
        return true;
    };

    var getOffCount;
    (function () {
        var offCount = { rows: {}, cols: {}, blos: {} };
        getOffCount = function () {
            for (var gi = 1; gi < LEN; gi++) {
                offCount.rows[gi] = 0;
                offCount.cols[gi] = 0;
                offCount.blos[gi] = 0;
            }
            return offCount;
        }
    })();

    var getSingleNumberChainResult = function ($g, onCnds, offCnds, num) {
        var chainResult = {
            onCndsList: [],
            offCndsList: [],
            offCount: getOffCount(),
            err: false
        };
        if (!addSingleChainResultOn($g, onCnds, num, chainResult)) {
            chainResult.err = true;
        }
        return chainResult;
    };

    var addSingleChainResultOn = function ($g, onCnds, onNum, chainResult) {
        if (chainResult.offCndsList.indexOf(onCnds) !== -1) return false;
        if (chainResult.onCndsList.indexOf(onCnds) !== -1) return true;
        chainResult.onCndsList.push(onCnds);
        if (!propagateAddSingleChainResultOn($g, onCnds, $g.rows[onCnds.cell.i], onNum, chainResult)) return false;
        if (!propagateAddSingleChainResultOn($g, onCnds, $g.cols[onCnds.cell.j], onNum, chainResult)) return false;
        if (!propagateAddSingleChainResultOn($g, onCnds, $g.blos[onCnds.cell.bi], onNum, chainResult)) return false;
        return true;
    };

    var propagateAddSingleChainResultOn = function ($g, onCnds, group, onNum, chainResult) {
        for (var i = 0, len = group.length; i < len; i++) {
            var cnds = group[i];
            if (!(onNum & cnds.hash)) continue;
            if (cnds == onCnds) continue;
            if (chainResult.offCndsList.indexOf(cnds) !== -1) continue;
            if (!addSingleChainResultOff($g, cnds, onNum, chainResult)) return false;
        }
        return true;
    };

    var addSingleChainResultOff = function ($g, offCnds, offNum, chainResult) {
        var cell = offCnds.cell;
        if (chainResult.onCndsList.indexOf(offCnds) !== -1) return false;
        if (chainResult.offCndsList.indexOf(offCnds) !== -1) return true;
        var ofcnt = chainResult.offCount;
        ofcnt.rows[cell.i]++
        ofcnt.cols[cell.j]++;
        ofcnt.blos[cell.bi]++;
        chainResult.offCndsList.push(offCnds);
        var numsMemo = $g.countMemo.numsMemo;
        if (!propagateSingleChainResultOff($g, offCnds, offNum, $g.rows[cell.i], numsMemo.rows[cell.i][offNum], ofcnt.rows[cell.i], chainResult)) return false;
        if (!propagateSingleChainResultOff($g, offCnds, offNum, $g.cols[cell.j], numsMemo.cols[cell.j][offNum], ofcnt.cols[cell.j], chainResult)) return false;
        if (!propagateSingleChainResultOff($g, offCnds, offNum, $g.blos[cell.bi], numsMemo.blos[cell.bi][offNum], ofcnt.blos[cell.bi], chainResult)) return false;
        return true;
    };

    var propagateSingleChainResultOff = function ($g, offCnds, offNum, group, groupMemoCount, offCount, chainResult) {
        if (groupMemoCount - offCount == 1) {
            for (var i = 0, len = group.length; i < len; i++) {
                var cnds = group[i];
                if (!(offNum & cnds.hash)) continue;
                if (cnds == offCnds) continue;
                if (chainResult.offCndsList.indexOf(cnds) !== -1) continue;
                if (!addSingleChainResultOn($g, cnds, offNum, chainResult)) return false;
                return true;
            }
        }
        return true;
    };

    var removeByXyzWing = function ($g, result) {
        for (var bi = 1; bi <= LEN; bi++) {
            var blo = $g.blos[bi];
            if (blo.length <= 2) continue;
            var len2Cells = [];

            for (var i = 0, len = blo.length; i < len; i++) {
                var cnds = blo[i];
                if (cnds.length == 2) len2Cells.push(cnds);
            }
            if (len2Cells.length == 0) continue;

            var len3Cells = [];
            for (var i = 0, len = blo.length; i < len; i++) {
                var cnds = blo[i];
                if (cnds.length == 3) len3Cells.push(cnds);
            }
            if (len3Cells.length == 0) continue;

            for (var i2 = 0, len2 = len2Cells.length; i2 < len2; i2++) {
                var cnds2 = len2Cells[i2];
                if (cnds2.solved) continue;
                for (var i3 = 0, len3 = len3Cells.length; i3 < len3; i3++) {
                    var cnds3 = len3Cells[i3];
                    if (cnds3.length != 3 || cnds2.solved) continue;
                    if (cnds2.hash == (cnds3.hash & cnds2.hash)) {
                        if (!removeByXyzWingSub($g, blo, bi, cnds2, cnds3, result)) return false;
                    }
                }
            }
        }
        return true;
    };

    var removeByXyzWingSub = function ($g, blo, bi, cnds2, cnds3, result) {
        var delNums = hashMemo[cnds2.hash];
        var delNum1 = delNums[0];
        var delNum2 = delNums[1];
        var targetHash1 = 0;
        var targetHash2 = 0;
        if ($g.countMemo.numsMemo.blos[bi][delNum1] > 2) targetHash1 = cnds3.hash - delNum2;
        if ($g.countMemo.numsMemo.blos[bi][delNum2] > 2) targetHash2 = cnds3.hash - delNum1;
        if (targetHash1 == 0 && targetHash2 == 0) return true;

        if (cnds2.cell.i != cnds3.cell.i) {
            var row = $g.rows[cnds3.cell.i];
            for (var i = 0, len = row.length; i < len; i++) {
                var cnds = row[i];
                if (cnds.cell.bi == bi) continue;
                if (cnds.hash == targetHash1 || cnds.hash == targetHash2) {
                    var delNum = cnds2.hash & cnds.hash;
                    var deleted = false;
                    for (var i2 = 0, len2 = blo.length; i2 < len2; i2++) {
                        var tcnds = blo[i2];
                        if (tcnds != cnds2 && tcnds != cnds3
                            && tcnds.cell.i == cnds3.cell.i
                            && (tcnds.hash & delNum)) {
                            if (!deleteCandidate($g, tcnds, delNum, result)) return false;
                            deleted = true;
                            if (len2 != blo.length) {
                                i2 = -1;
                                len2 = blo.length;
                            }
                        }
                    }
                    if (deleted) {
                        if (cnds2.solved || cnds3.length != 3) return true;
                        break;
                    }
                }
            }
        }
        if (cnds2.cell.j != cnds3.cell.j) {
            var col = $g.cols[cnds3.cell.j];
            for (var i = 0, len = col.length; i < len; i++) {
                var cnds = col[i];
                if (cnds.cell.bi == bi) continue;
                if (cnds.hash == targetHash1 || cnds.hash == targetHash2) {
                    var delNum = cnds2.hash & cnds.hash;
                    var deleted = false;
                    for (var i2 = 0, len2 = blo.length; i2 < len2; i2++) {
                        var tcnds = blo[i2];
                        if (tcnds != cnds2 && tcnds != cnds3
                            && tcnds.cell.j == cnds3.cell.j
                            && (tcnds.hash & delNum)) {
                            if (!deleteCandidate($g, tcnds, delNum, result)) return false;
                            deleted = true;
                            if (len2 != blo.length) {
                                i2 = -1;
                                len2 = blo.length;
                            }
                        }
                    }
                    if (deleted) return true;
                }
            }
        }
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