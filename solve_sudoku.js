var exports = exports;
if (!exports) exports = {};
var solver = exports;
(function () {
    var version = "1.6.0";
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

        cellNames = [];
        for (var i = 0; i < LEN; i++) {
            var cellNameRow = [];
            for (var j = 0; j < LEN; j++) {
                var cellName = i * 9 + j;
                cellNameRow.push(cellName)
            }
            cellNames.push(cellNameRow);
        }

        allCells = [];
        for (var i = 1; i <= LEN; i++) {
            for (var j = 1; j <= LEN; j++) {
                var k = Math.floor((j - 1) / 3) + Math.floor((i - 1) / 3) * 3 + 1;
                var bo = (j - 1) % 3 + ((i - 1) % 3) * 3;
                var cellName = cellNames[i - 1][j - 1];
                var cell = {
                    key: cellName, i: i, j: j, k: k,
                    idx: [i, j, k],
                    //rohash: 1 << (j - 1), cohash: 1 << (i - 1), bohash: 1 << bo,
                    ghash: groupIds.rows[i] | groupIds.cols[j] | groupIds.blos[k]
                };
                allCells.push(cell);
            }
        }
    };

    var iterateAllCell = function (func) {
        for (var i = 0, len = allCells.length; i < len; i++) {
            var cell = allCells[i];
            if (!func(cell.key, cell.i, cell.j, cell.k)) return false;
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
        if (!validateQuestion(q)) return { result: false, dup: false, invalid: true, memoMap: getNewMemoMap(), countMemo: null };
        return solveSudoku(transformQToBit(q), 1, true, null, null, null);
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

    var solveSudoku = function (q, depth, checkDupSol, memoMap, countMemo, temps) {
        infomations.callCount++;
        if (depth > infomations.maxDepth) infomations.maxDepth = depth;
        var useMemoMap = false;
        if (!memoMap) {
            memoMap = getNewMemoMap();
            countMemo = { rowsMemo: new Array(10), colsMemo: new Array(10), blosMemo: new Array(10) };
        } else {
            useMemoMap = true;
        }

        var $g = {
            leftCount: LEN * LEN,
            memoMap: memoMap,
            rows: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] },
            cols: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] },
            blos: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] },
            rowsMemo: { 1: 511, 2: 511, 3: 511, 4: 511, 5: 511, 6: 511, 7: 511, 8: 511, 9: 511 },
            colsMemo: { 1: 511, 2: 511, 3: 511, 4: 511, 5: 511, 6: 511, 7: 511, 8: 511, 9: 511 },
            blosMemo: { 1: 511, 2: 511, 3: 511, 4: 511, 5: 511, 6: 511, 7: 511, 8: 511, 9: 511 },
            countMemo: countMemo,
            numsLeft: { 1: LEN, 2: LEN, 4: LEN, 8: LEN, 16: LEN, 32: LEN, 64: LEN, 128: LEN, 256: LEN },
            biValueChainQueue: []
        };

        initQuestion(memoMap, $g, useMemoMap);

        var removeCount = 0;
        var result = { removeCount: 0 };
        var solved = false;

        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
                if (q[i][j]) {
                    deleteAllCandedatesInitQ($g, $g.memoMap[cellNames[i][j]], q[i][j]);
                }
            }
        }

        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
                if (q[i][j]) {
                    var cnds = $g.memoMap[cellNames[i][j]];
                    if (!cnds.ok) {
                        var skip = false;
                        if (depth !== 1) {
                            for (var ti = 0; ti < temps.length; ti++) {
                                if (!(skip = temps[ti].cell.key !== cnds.cell.key)) break;
                            }
                        }
                        if (!decideCandidates($g, cnds.cell.key, q[i][j], result, skip)) return endAsError(memoMap);
                    }
                }
            }
        }

        if (depth > 1) {
            for (var ti = 0; ti < temps.length; ti++) {
                var cell = temps[ti].cell;
                for (var ni = 0; ni < LEN; ni++) {
                    var num = NUMS[ni];
                    if (($g.rowsMemo[cell.i] & num) && $g.countMemo.rowsMemo[cell.i][num] === 1) {
                        if (!decideSingleNumberInList($g, $g.rows[cell.i], num, result)) return false;
                    }
                    if (($g.colsMemo[cell.j] & num) && $g.countMemo.colsMemo[cell.j][num] === 1) {
                        if (!decideSingleNumberInList($g, $g.cols[cell.j], num, result)) return false;
                    }
                    if (($g.blosMemo[cell.k] & num) && $g.countMemo.blosMemo[cell.k][num] === 1) {
                        if (!decideSingleNumberInList($g, $g.blos[cell.k], num, result)) return false;
                    }
                }
            }
        }

        infomations.removeCount.decideCandidate += result.removeCount;
        var checkPoint = 0;
        var outerCheckpoint = 0;
        if ($g.leftCount === 0) solved = true;
        var start = null;
        while (!solved) {
            if ($g.leftCount >= 75) break;
            removeCount = 0;
            result.removeCount = 0;
            checkPoint = 0;
            while (true) {
                removeCount = 0;
                start = pf.start();
                if (!removeByHiddenPair($g, result)) return endAsError(memoMap);
                infomations.cost.hiddenPair += pf.end(start);
                removeCount += result.removeCount;
                infomations.removeCount.hiddenPair += result.removeCount;
                if (result.removeCount) outerCheckpoint = checkPoint = 0;
                else if (++checkPoint >= 5) break;
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
                if (result.removeCount) outerCheckpoint = checkPoint = 0;
                else if (++checkPoint >= 5) break;
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
                if (result.removeCount) outerCheckpoint = checkPoint = 0;
                else if (++checkPoint >= 5) break;
                result.removeCount = 0;
                if ($g.leftCount === 0) {
                    solved = true;
                    break;
                }

                start = pf.start();
                if (!removeByNakedTriplet($g, result)) return endAsError(memoMap);
                infomations.cost.nakedTriplet += pf.end(start);
                removeCount += result.removeCount;
                infomations.removeCount.nakedTriplet += result.removeCount;
                if (result.removeCount) outerCheckpoint = checkPoint = 0;
                else if (++checkPoint >= 5) break;
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
                if (result.removeCount) outerCheckpoint = checkPoint = 0;
                else if (++checkPoint >= 5) break;
                result.removeCount = 0;
                if ($g.leftCount === 0) {
                    solved = true;
                    break;
                }
            }
            removeCount = 0;

            if (solved) break;
            if ($g.leftCount >= 65) break;

            start = pf.start();
            if (!removeByBiValueChain($g, result)) return endAsError(memoMap);
            infomations.cost.biValueChain += pf.end(start);
            if (result.removeCount) outerCheckpoint = 0;
            else if (++outerCheckpoint >= 3) break;
            removeCount += result.removeCount;
            infomations.removeCount.biValueChain += result.removeCount;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }
            if (removeCount) continue;

            start = pf.start();
            if (!removeBySingleNumberChain($g, result)) return endAsError(memoMap);
            infomations.cost.singleNumberChain += pf.end(start);
            removeCount += result.removeCount;
            infomations.removeCount.singleNumberChain += result.removeCount;
            if (result.removeCount) outerCheckpoint = 0;
            else if (++outerCheckpoint >= 3) break;
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
            if (result.removeCount) outerCheckpoint = 0;
            else if (++outerCheckpoint >= 3) break;
            result.removeCount = 0;
            if ($g.leftCount === 0) {
                solved = true;
                break;
            }

            if (removeCount == 0) break;
        }

        if ($g.leftCount === 0) {
            if (validateMemoMap(memoMap)) {
                return { result: true, dup: false, invalid: false, memoMap: memoMap, countMemo: $g.countMemo };
            } else {
                return endAsError(memoMap);
            }
        } else {
            var useDoubleTemporary = false;
            if (45 <= $g.leftCount && $g.leftCount <= 64) {
                var leftCount = 0;
                var nlist = NUMS;
                for (var ii = 1; ii <= LEN; ii++)
                    for (var jj = 0; jj < LEN; jj++)
                        leftCount += $g.countMemo.rowsMemo[ii][nlist[jj]];
                useDoubleTemporary = leftCount >= 230;
            }

            var patterns = [];
            var minNum = 100;
            var candidates = null;
            if (useDoubleTemporary) {
                var mlCnd1 = null;
                var mlCnd2 = null;
                for (var ai = 0, alen = allCells.length; ai < alen; ai++) {
                    candidates = $g.memoMap[allCells[ai].key];
                    if (candidates.ok) continue;
                    if (!mlCnd1) {
                        mlCnd1 = candidates;
                        continue;
                    }
                    var num = candidates.len;
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
                    if (candidates.ok) continue;
                    var num = candidates.len;
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
                var newQ = createQuestionFromMemoMap($g, memoMap, pattern);
                var q1 = newQ[0];
                var memoMap1 = newQ[1];
                var countMemo1 = newQ[2]
                var result = solveSudoku(q1, depth + 1, checkDupSol, memoMap1, countMemo1, pattern);

                if (result.result) {
                    if (result.secondResult) {
                        return result;
                    }
                    if (firstResult) {
                        firstResult.secondResult = result;
                        firstResult.dup = true;
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
        if (!useMemoMap) {
            var rowsNumsMemo = $g.countMemo.rowsMemo;
            var colsNumsMemo = $g.countMemo.colsMemo;
            var blosNumsMemo = $g.countMemo.blosMemo;
            var nums = NUMS;
            for (var listIndex = 1; listIndex <= LEN; listIndex++) {
                var rowMemo = rowsNumsMemo[listIndex] = new Array(257);
                var colMemo = colsNumsMemo[listIndex] = new Array(257);
                var bloMemo = blosNumsMemo[listIndex] = new Array(257);

                for (var ni = 0; ni < LEN; ni++) {
                    var hash = nums[ni];
                    rowMemo[hash] = LEN;
                    colMemo[hash] = LEN;
                    bloMemo[hash] = LEN;
                }
            }
        }

        for (var cli = 0, len = allCells.length; cli < len; cli++) {
            var cell = allCells[cli];
            var candidates = memoMap[cell.key];
            $g.rows[cell.i].push(candidates);
            $g.cols[cell.j].push(candidates);
            $g.blos[cell.k].push(candidates);
        }
    };

    var getNewMemoMap = function () {
        var memoMap = [];
        for (var i = 0, len = allCells.length; i < len; i++) {
            var cell = allCells[i];
            memoMap[cell.key] = createCandidates(511, 9, cell);
        }
        return memoMap;
    };

    var createCandidates = function (hash, len, cell) {
        return { hash: hash, len: len, cell: cell, ok: false };
    };

    var deleteAllCandedatesInitQ = function ($g, candidates, decidedNum) {
        var delHash = candidates.hash - decidedNum;
        for (var dellNums = hashMemo[delHash], i = 0, len = dellNums.length; i < len; i++) {
            deleteCandidateInitQ($g, candidates, dellNums[i]);
        }
    };

    var deleteCandidateInitQ = function ($g, candidates, deleteNumber) {
        candidates.hash -= deleteNumber;
        candidates.len--;
        $g.countMemo.rowsMemo[candidates.cell.i][deleteNumber]--;
        $g.countMemo.colsMemo[candidates.cell.j][deleteNumber]--;
        $g.countMemo.blosMemo[candidates.cell.k][deleteNumber]--;
    };

    var deleteAllCandedates = function ($g, candidates, decidedNum, result) {
        if (candidates.ok) {
            if (decidedNum != candidates.hash) return false;
            return true;
        }
        var len = candidates.len;
        if (len == 1) {
            return decideCandidates($g, candidates.cell.key, decidedNum, result, false);
        }

        var candidatesNums = hashMemo[candidates.hash];
        for (var idx = 0; idx < len; idx++) {
            var num = candidatesNums[idx];
            if ((candidates.hash & num) && decidedNum != num) {
                if (candidates.ok) break;
                if (!deleteCandidate($g, candidates, num, result, true)) {
                    return false;
                }
            }
        }
        return true;
    };

    var deleteCandidate = function ($g, candidates, delNum, result, allDelete) {
        result.removeCount++;
        candidates.hash -= delNum;
        candidates.len--;
        var cell = candidates.cell;
        var row = $g.countMemo.rowsMemo[cell.i];
        row[delNum]--;
        var col = $g.countMemo.colsMemo[cell.j];
        col[delNum]--;
        var blo = $g.countMemo.blosMemo[cell.k];
        blo[delNum]--;

        if (row[delNum] === 0 || col[delNum] === 0 || blo[delNum] === 0) return false;
        if (candidates.hash === 0) return false;
        if (candidates.len === 1)
            if (!decideCandidates($g, cell.key, candidates.hash, result, false)) return false;

        if (($g.rowsMemo[cell.i] & delNum) && row[delNum] === 1)
            if (!decideSingleNumberInList($g, $g.rows[cell.i], delNum, result)) return false;

        if (($g.colsMemo[cell.j] & delNum) && col[delNum] === 1)
            if (!decideSingleNumberInList($g, $g.cols[cell.j], delNum, result)) return false;

        if (($g.blosMemo[cell.k] & delNum) && blo[delNum] === 1)
            if (!decideSingleNumberInList($g, $g.blos[cell.k], delNum, result)) return false;

        if (candidates.len === 2) {
            $g.biValueChainQueue.push(candidates);
            if (!allDelete) {
                if (!removeByNakedPairPropagation($g, $g.rows[cell.i], candidates, result)) return false;
                if (candidates.len === 2)
                    if (!removeByNakedPairPropagation($g, $g.cols[cell.j], candidates, result)) return false;
                if (candidates.len === 2)
                    if (!removeByNakedPairPropagation($g, $g.blos[cell.k], candidates, result)) return false;
            }
        }
        return true;
    };

    var endAsError = function (memoMap) {
        return { result: false, dup: false, invalid: true, memoMap: memoMap, countMemo: null };
    };

    var decideCandidates = function ($g, key, decidedNum, result, skip) {
        $g.leftCount--;
        $g.numsLeft[decidedNum]--;
        var candidates = $g.memoMap[key];
        var cell = candidates.cell;
        var row = $g.rows[cell.i];
        var ri = row.indexOf(candidates);
        row.splice(ri, 1);
        var col = $g.cols[cell.j];
        var ci = col.indexOf(candidates);
        col.splice(ci, 1);
        var blo = $g.blos[cell.k];
        var bi = blo.indexOf(candidates);
        blo.splice(bi, 1);
        $g.rowsMemo[cell.i] -= decidedNum;
        $g.colsMemo[cell.j] -= decidedNum;
        $g.blosMemo[cell.k] -= decidedNum;
        candidates.ok = true;
        if (skip) return true;
        return removeCandidatesFromList($g, row, decidedNum, result)
            && removeCandidatesFromList($g, col, decidedNum, result)
            && removeCandidatesFromList($g, blo, decidedNum, result);
    };

    var removeCandidatesFromList = function ($g, list, decidedNum, result) {
        for (var li = 0, llen = list.length; li < llen; li++) {
            var candidates = list[li];
            if (candidates.hash & decidedNum) {
                if (!deleteCandidate($g, candidates, decidedNum, result)) return false;
                if (llen != list.length) {
                    li = -1;
                    llen = list.length;
                }
            }
        }
        return true;
    };

    var decideSingleNumberInList = function ($g, list, num, result) {
        for (var li = 0, llen = list.length; li < llen; li++) {
            var cnds = list[li];
            if (cnds.hash & num) {
                if (!deleteAllCandedates($g, cnds, num, result)) {
                    return false;
                }
                return true;
            }
        }
        return false;
    };

    var removeByNakedPairPropagation = function ($g, group, cnds, result) {
        var glen = group.length;
        if (glen <= 2) return true;
        for (var i = 0; i < glen; i++) {
            var tcnds = group[i];
            if (cnds !== tcnds && cnds.hash === tcnds.hash) {
                var nums = hashMemo[cnds.hash];
                for (var i = 0; i < glen; i++) {
                    var ocnds = group[i];
                    if (ocnds !== tcnds && ocnds !== cnds) {
                        for (var ni = 0, nlen = nums.length; ni < nlen; ni++) {
                            if (ocnds.ok) break;
                            var num = nums[ni];
                            if (ocnds.hash & num) {
                                if (!deleteCandidate($g, ocnds, num, result)) return false;
                            }
                        }
                        if (group.length !== glen) {
                            glen = group.length;
                            i = -1;
                        }
                    }
                }
                return true;
            }
        }
        return true;
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
        if (glen <= 3) return true;

        var len = 0;
        for (var i = 0; i < glen; i++) {
            var cnds = group[i];
            if (cnds.len <= 3) len++;
        }
        if (len <= 2) return true;

        for (var i1 = 0; i1 < glen - 2; i1++) {
            var c1 = group[i1];
            if (c1.len > 3) continue;
            for (var i2 = i1 + 1; i2 < glen - 1; i2++) {
                var c2 = group[i2];
                if (c2.len > 3) continue;
                if (hashLengthMemo[(c1.hash | c2.hash)] > 3) continue;
                for (var i3 = i2 + 1; i3 < glen; i3++) {
                    var c3 = group[i3];
                    if (c3.len > 3) continue;
                    var nums = hashMemo[(c1.hash | c2.hash | c3.hash)];
                    if (nums.length <= 3) {
                        for (var i = 0; i < glen; i++) {
                            var cnds = group[i];
                            if (cnds !== c1 && cnds !== c2 && cnds !== c3) {
                                for (var ni = 0, nlen = nums.length; ni < nlen; ni++) {
                                    if (cnds.ok) break;
                                    var num = nums[ni];
                                    if (!(cnds.hash & num)) continue;
                                    if (!deleteCandidate($g, cnds, num, result)) return false;
                                }
                                if (group.length !== glen) {
                                    glen = group.length;
                                    i = -1;
                                }
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
        if ($g.numsLeft[num] < 2 || $g.numsLeft[num] == 9) return true;
        var numberLeftCells = [];
        var numberLeftBlos = [];
        var bKeys = [];
        for (var k = 1; k <= LEN; k++) {
            if ($g.blosMemo[k] & num) {
                var blo = $g.blos[k];
                var bloCandidates = [];
                numberLeftBlos.push(bloCandidates);
                bKeys.push(k);
                for (var mi = 0, len = blo.length; mi < len; mi++) {
                    var cnds = blo[mi];
                    if (cnds.hash & num) {
                        numberLeftCells.push(cnds);
                        bloCandidates.push(cnds);
                    }
                }
            }
        }

        var blen = bKeys.length;
        var indexes = getAllZeroArray(blen);
        var currrentBkey = 0;
        var firstBlosLen = numberLeftBlos[0].length;
        var firstBkey = bKeys[0];
        var ghashHistory = [];
        for (var li = 0, len = numberLeftCells.length; li < len; li++) {
            var target = numberLeftCells[li];
            if (!(target.hash & num)) continue;
            setArrayAllZero(indexes, blen);
            currrentBkey = target.cell.k;
            var occupiedGroups = target.cell.ghash;
            var foundPattern = true;
            for (var bKeyIndex = 0; bKeyIndex < blen; bKeyIndex++) {
                if (currrentBkey === bKeys[bKeyIndex]) continue;
                var foundCandidate = false;
                var bloCells = numberLeftBlos[bKeyIndex];
                for (var len = bloCells.length; indexes[bKeyIndex] < len; indexes[bKeyIndex]++) {
                    var subTarget = bloCells[indexes[bKeyIndex]];
                    if (!(occupiedGroups & subTarget.cell.ghash) && (subTarget.hash & num)) {
                        ghashHistory.push(occupiedGroups);
                        occupiedGroups |= subTarget.cell.ghash;
                        foundCandidate = true;
                        break;
                    }
                }
                if (foundCandidate) {
                    continue;
                } else {
                    if (bKeyIndex === 0 ||
                        (bKeyIndex === 1 && (indexes[0] + 1 >= firstBlosLen || currrentBkey === firstBkey))) {
                        foundPattern = false;
                        break;
                    }
                    indexes[bKeyIndex] = 0;
                    occupiedGroups = ghashHistory.pop();
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
            var cnds = $g.biValueChainQueue.pop();
            if (cnds.ok) continue;
            var bival = hashMemo[cnds.hash];
            var first = getChainResult($g, cnds, cnds, bival[0], bival[1]);
            var second = getChainResult($g, cnds, cnds, bival[1], bival[0]);
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
                if (!deleteAllCandedates($g, candidates, trueResult.onKeys[trkey], result)) return false;
            }
            return true;
        }

        var fkeys = first.onKeysList;
        var skeys = second.onKeysList;
        for (var fi = 0, flen = fkeys.length; fi < flen; fi++) {
            var fkey = fkeys[fi];
            var candidates = $g.memoMap[fkey];
            for (var si = 0, slen = skeys.length; si < slen; si++) {
                var skey = skeys[si];
                if (fkey == skey) {
                    if (first.onKeys[fkey] == second.onKeys[skey])
                        if (!deleteAllCandedates($g, candidates, first.onKeys[fkey], result)) return false;
                    break;
                }
            }
        }

        var fkeys = first.offKeysList;
        var skeys = second.offKeysList;
        for (var fi = 0, flen = fkeys.length; fi < flen; fi++) {
            var fkey = fkeys[fi];
            var candidates = $g.memoMap[fkey];
            for (var si = 0, slen = skeys.length; si < slen; si++) {
                var skey = skeys[si];
                var offNumHash;
                if (fkey == skey) {
                    if ((offNumHash = first.offKeys[fkey] & second.offKeys[skey])) {
                        for (var offi = 0, nums = hashMemo[offNumHash], nlen = nums.length; offi < nlen; offi++) {
                            var num = nums[offi];
                            if (candidates.hash & num) {
                                if (!deleteCandidate($g, candidates, num, result)) return false;
                            }
                        }
                    }
                    break;
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
            return new Array(257);
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
            onKeys: new Array(81),
            offKeys: new Array(81),
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

    var addChainResultOn = function ($g, cnds, onNum, chainResult) {
        if (!addChainResult(chainResult, cnds.cell, onNum)) return false;
        if (!propagateAddChainResultOn($g, cnds, $g.rows[cnds.cell.i], onNum, chainResult)) return false;
        if (!propagateAddChainResultOn($g, cnds, $g.cols[cnds.cell.j], onNum, chainResult)) return false;
        if (!propagateAddChainResultOn($g, cnds, $g.blos[cnds.cell.k], onNum, chainResult)) return false;
        return true;
    };

    var propagateAddChainResultOn = function ($g, cnds, group, onNum, chainResult) {
        for (var gi = 0, glen = group.length; gi < glen; gi++) {
            var gcnds = group[gi];
            if (gcnds === cnds) continue;
            var key = gcnds.cell.key;
            if (gcnds.hash & onNum) {
                if (gcnds.len === 2 && !chainResult.onKeys[key]) {
                    if (!addChainResultOn($g, gcnds, gcnds.hash - onNum, chainResult)) return false;
                }
                if (!addChainResultOff($g, gcnds, onNum, chainResult)) return false;
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
            if (leftNums === 0) return false;
            if (hashLengthMemo[leftNums] === 1) {
                if (chainResult.onKeys[key]) {
                    if (chainResult.onKeys[key] !== leftNums) return false;
                } else {
                    if (!addChainResultOn($g, cnds, leftNums, chainResult)) return false;
                }
            }
        }
        var N = chainResult.offNumsRecord;

        var i = cnds.cell.i;
        N.rows[i][offNum]++;
        if ($g.countMemo.rowsMemo[i][offNum] - N.rows[i][offNum] === 1) {
            if (!addChainResultOffGroups($g, $g.rows[i], offNum, chainResult)) return false;
        }

        var j = cnds.cell.j;
        N.cols[j][offNum]++;
        if ($g.countMemo.colsMemo[j][offNum] - N.cols[j][offNum] === 1) {
            if (!addChainResultOffGroups($g, $g.cols[j], offNum, chainResult)) return false;
        }

        var bi = cnds.cell.k;
        N.blos[bi][offNum]++;
        if ($g.countMemo.blosMemo[bi][offNum] - N.blos[bi][offNum] === 1) {
            if (!addChainResultOffGroups($g, $g.blos[bi], offNum, chainResult)) return false;
        }

        return true;
    };

    var addChainResultOffGroups = function ($g, group, offNum, chainResult) {
        for (var gi = 0, glen = group.length; gi < glen; gi++) {
            var gcnds = group[gi];
            var key = gcnds.cell.key;
            if (chainResult.offKeys[key] & offNum) continue;
            if (gcnds.hash & offNum) {
                if (chainResult.onKeys[key]) {
                    if (chainResult.onKeys[key] !== offNum) return false;
                } else {
                    if (!addChainResultOn($g, gcnds, offNum, chainResult)) return false;
                    for (var offNums = hashMemo[gcnds.hash - offNum], ofni = 0, ofnlen = offNums.length; ofni < ofnlen; ofni++) {
                        if (!addChainResultOff($g, gcnds, offNums[ofni], chainResult)) return false;
                    }
                }
                return true;
            }
        }
        return false;
    };

    var addChainResult = function (chainResult, cell, num) {
        chainResult.onKeys[cell.key] = num;
        chainResult.onKeysList.push(cell.key);
        if (chainResult.numsRecords[num] & cell.ghash) return false;
        chainResult.numsRecords[num] |= cell.ghash;
        return true;
    };

    var removeByHiddenPair = function ($g, result) {
        for (var gi = 1; gi <= LEN; gi++) {
            if (!removeByHiddenPairSub($g, $g.rows[gi], $g.countMemo.rowsMemo[gi], result)) return false;
            if (!removeByHiddenPairSub($g, $g.cols[gi], $g.countMemo.colsMemo[gi], result)) return false;
            if (!removeByHiddenPairSub($g, $g.blos[gi], $g.countMemo.blosMemo[gi], result)) return false;
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
                    if ((cnds.hash & pairNumsHash) === pairNumsHash) {
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
                    var delNum = fDelNums[i];
                    if (fcnds.hash & delNum) {
                        if (!deleteCandidate($g, fcnds, delNum, result)) return false;
                    }
                }
                var sDelNums = hashMemo[scnds.hash - (scnds.hash & pairNumsHash)];
                for (var i = 0, len = sDelNums.length; i < len; i++) {
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
            if (!removeByHiddenTripletSub($g, $g.rows[gi], $g.countMemo.rowsMemo[gi], result)) return false;
            if (!removeByHiddenTripletSub($g, $g.cols[gi], $g.countMemo.colsMemo[gi], result)) return false;
            if (!removeByHiddenTripletSub($g, $g.blos[gi], $g.countMemo.blosMemo[gi], result)) return false;
        }
        return true;
    }

    var removeByHiddenTripletSub = function ($g, group, numsMemo, result) {
        var glen = group.length;
        if (glen <= 3) return true;
        var triNumsCollectionHash = 0;
        for (var ni = 0, nums = NUMS, nlen = LEN; ni < nlen; ni++) {
            var num = nums[ni];
            if (numsMemo[num] === 2 || numsMemo[num] === 3) triNumsCollectionHash += num;
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
                        if (cnds.hash & triNumsHash) {
                            if (tcnds) {
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

    var flipped = true;
    var removeByIntersection = function ($g, result) {
        var nums = NUMS, nlen = LEN;
        var cm = $g.countMemo;
        for (var gi = 1; gi <= LEN; gi++) {
            var rowsMemo = cm.rowsMemo[gi];
            var colsMemo = cm.colsMemo[gi];
            var blosMemo = cm.blosMemo[gi];
            for (var ni = 0; ni < nlen; ni++) {
                var num = nums[ni];
                if (flipped) {
                    if (rowsMemo[num] == 2 || rowsMemo[num] == 3)
                        if (!removeByIntersectionSub($g, $g.rows[gi], gi, 0, 2, num, rowsMemo[num], $g.blos, cm.blosMemo, result)) return false;
                    if (colsMemo[num] == 2 || colsMemo[num] == 3)
                        if (!removeByIntersectionSub($g, $g.cols[gi], gi, 1, 2, num, colsMemo[num], $g.blos, cm.blosMemo, result)) return false;
                } else {
                    if (blosMemo[num] == 2 || blosMemo[num] == 3)
                        if (!removeByIntersectionSub($g, $g.blos[gi], gi, 2, 0, num, blosMemo[num], $g.rows, cm.rowsMemo, result)) return false;
                    if (blosMemo[num] == 2 || blosMemo[num] == 3)
                        if (!removeByIntersectionSub($g, $g.blos[gi], gi, 2, 1, num, blosMemo[num], $g.cols, cm.colsMemo, result)) return false;
                }
            }
        }
        flipped = !flipped;
        return true;
    };

    var removeByIntersectionSub = function ($g, group, gi, gKey, tgKey, num, numCount, tGroups, tGroupMemo, result) {
        var tgi = 0;
        var count = 0;
        for (var i = 0, glen = group.length; i < glen; i++) {
            var cnds = group[i];
            if (cnds.hash & num) {
                count++;
                if (tgi) {
                    if (tgi !== cnds.cell.idx[tgKey]) return true;
                } else {
                    tgi = cnds.cell.idx[tgKey];
                    if (tGroupMemo[tgi][num] === numCount) return true;
                }
                if (count === numCount) break;
            }
        }
        if (!tgi) return false;

        var tGroup = tGroups[tgi];
        for (var i = 0, tglen = tGroup.length; i < tglen; i++) {
            var cnds = tGroup[i];
            if (cnds.cell.idx[gKey] != gi && (cnds.hash & num)) {
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
                var rowMemo = $g.countMemo.rowsMemo[gi];
                if (rowMemo[num] == 2) {
                    if (!removeBySingleNumberChainSub($g, $g.rows[gi], num, result)) return false;
                    //break;
                }
            }
        }
        for (var ni = 0; ni < nlen; ni++) {
            var num = nums[ni];
            for (var gi = 1; gi <= LEN; gi++) {
                var colMemo = $g.countMemo.colsMemo[gi];
                if (colMemo[num] == 2) {
                    if (!removeBySingleNumberChainSub($g, $g.cols[gi], num, result)) return false;
                    //break;
                }
            }
        }
        //for (var ni = 0; ni < nlen; ni++) {
        //    var num = nums[ni];
        //    for (var gi = 1; gi <= LEN; gi++) {
        //        var bloMemo = $g.countMemo.blosMemo[gi];
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
        if (!scnds) return false;
        if (fcnds.len == 2 || scnds.len == 2) return true;

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
                if (!deleteAllCandedates($g, trueResult.onCndsList[ti], num, result)) return false;
            }
            return true;
        }

        for (var fi = 0, flen = first.onCndsList.length; fi < flen; fi++) {
            var fcnds = first.onCndsList[fi];
            for (var si = 0, slen = second.onCndsList.length; si < slen; si++) {
                if (fcnds == second.onCndsList[si]) {
                    if (!deleteAllCandedates($g, fcnds, num, result)) return false;
                    break;
                }
            }
        }

        for (var fi = 0, flen = first.offCndsList.length; fi < flen; fi++) {
            var fcnds = first.offCndsList[fi];
            if (!(fcnds.hash & num)) continue;
            for (var si = 0, slen = second.offCndsList.length; si < slen; si++) {
                if (fcnds == second.offCndsList[si]) {
                    if (!deleteCandidate($g, fcnds, num, result)) return false;
                    break;
                }
            }
        }
        return true;
    };

    var getOffCount;
    (function () {
        var offCount = { rows: new Array(10), cols: new Array(10), blos: new Array(10) };
        getOffCount = function () {
            for (var gi = 1; gi <= LEN; gi++) {
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
        if (!propagateAddSingleChainResultOn($g, onCnds, $g.blos[onCnds.cell.k], onNum, chainResult)) return false;
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
        ofcnt.blos[cell.k]++;
        chainResult.offCndsList.push(offCnds);
        if (!propagateSingleChainResultOff($g, offCnds, offNum, $g.rows[cell.i], $g.countMemo.rowsMemo[cell.i][offNum], ofcnt.rows[cell.i], chainResult)) return false;
        if (!propagateSingleChainResultOff($g, offCnds, offNum, $g.cols[cell.j], $g.countMemo.colsMemo[cell.j][offNum], ofcnt.cols[cell.j], chainResult)) return false;
        if (!propagateSingleChainResultOff($g, offCnds, offNum, $g.blos[cell.k], $g.countMemo.blosMemo[cell.k][offNum], ofcnt.blos[cell.k], chainResult)) return false;
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
            return false;
        }
        return true;
    };

    var removeByXyzWing = function ($g, result) {
        for (var bi = 1; bi <= LEN; bi++) {
            var blo = $g.blos[bi];
            for (var i2 = 0, blen = blo.length; i2 < blen; i2++) {
                var cnds2 = blo[i2];
                if (cnds2.len !== 2) continue;
                for (var i3 = 0; i3 < blen; i3++) {
                    var cnds3 = blo[i3];
                    if (cnds3.len != 3) continue;
                    if (cnds2.hash == (cnds3.hash & cnds2.hash)) {
                        if (!removeByXyzWingSub($g, blo, bi, cnds2, cnds3, result)) return false;
                        if (blen != blo.length) {
                            blen = blo.length;
                            i2 = -1;
                            break;
                        }
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
        if ($g.countMemo.blosMemo[bi][delNum1] > 2) targetHash1 = cnds3.hash - delNum2;
        if ($g.countMemo.blosMemo[bi][delNum2] > 2) targetHash2 = cnds3.hash - delNum1;
        if (targetHash1 == 0 && targetHash2 == 0) return true;

        if (cnds2.cell.i !== cnds3.cell.i) {
            var row = $g.rows[cnds3.cell.i];
            for (var i = 0, len = row.length; i < len; i++) {
                var cnds = row[i];
                if (cnds.cell.k == bi) continue;
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
                        if (cnds2.ok || cnds3.len != 3) return true;
                        break;
                    }
                }
            }
        }
        if (cnds2.cell.j !== cnds3.cell.j) {
            var col = $g.cols[cnds3.cell.j];
            for (var i = 0, len = col.length; i < len; i++) {
                var cnds = col[i];
                if (cnds.cell.k == bi) continue;
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

    var validateMemoMap;
    (function () {
        var _rows = new Array(10);
        var _cols = new Array(10);
        var _blos = new Array(10);
        validateMemoMap = function (memoMap) {
            var rows = _rows;
            var cols = _cols;
            var blos = _blos;
            for (var gi = 1; gi <= LEN; gi++) {
                rows[gi] = 0;
                cols[gi] = 0;
                blos[gi] = 0;
            }

            for (var cli = 0, len = allCells.length; cli < len; cli++) {
                var cell = allCells[cli];

                var candidates = memoMap[cell.key];
                if (candidates.len != 1) return false;
                var value = candidates.hash;

                if (rows[cell.i] & value) return false;
                rows[cell.i] += value;

                if (cols[cell.j] & value) return false;
                cols[cell.j] += value;

                if (blos[cell.k] & value) return false;
                blos[cell.k] += value;
            }
            return true;
        };
    })();



    var validateQuestion = function (q) {
        var rows = new Array(LEN);
        var cols = new Array(LEN);
        var blos = new Array(LEN);
        for (var cli = 0, len = allCells.length; cli < len; cli++) {
            var cell = allCells[cli];
            var i = cell.i - 1;
            var j = cell.j - 1;
            var k = cell.k - 1;
            var num;
            if (!(num = q[i][j])) return true;
            var row = rows[i] ? rows[i] : rows[i] = [];
            var col = cols[j] ? cols[j] : cols[j] = [];
            var blo = blos[k] ? blos[k] : blos[k] = [];
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

    var createQuestionFromMemoMap = function ($g, memoMap, pattern) {
        var q = [];
        for (var i = 0; i < LEN; i++) {
            var row = [];
            for (var j = 0; j < LEN; j++) {
                var candidates = memoMap[cellNames[i][j]];
                if (candidates.len === 1) {
                    row.push(candidates.hash);
                } else {
                    row.push(0);
                }
            }
            q.push(row);
        }

        var newMemoMap = copyMemoMap(memoMap);
        var newCountMemo = copyCountMemo($g.countMemo);
        for (var pi = 0, plen = pattern.length; pi < plen; pi++) {
            var temp = pattern[pi];
            var memo = newMemoMap[temp.cell.key];
            newMemoMap[temp.cell.key] = createCandidates(temp.num, 1, temp.cell);
            for (var ni = 0, nums = hashMemo[memo.hash - temp.num], nlen = nums.length; ni < nlen; ni++) {
                var num = nums[ni];
                newCountMemo.rowsMemo[temp.cell.i][num]--;
                newCountMemo.colsMemo[temp.cell.j][num]--;
                newCountMemo.blosMemo[temp.cell.k][num]--;
            }
            q[temp.cell.i - 1][temp.cell.j - 1] = temp.num;
        }
        return [q, newMemoMap, newCountMemo];
    };

    var copyMemoMap = function (memoMap) {
        var newMemoMap = [];
        for (var index = 0; index < 81; index++) {
            var memo = memoMap[index];
            newMemoMap.push(createCandidates(memo.hash, memo.len, memo.cell));
        }
        return newMemoMap;
    };

    var copyCountMemo = function (countMemo) {
        var rowsNumsMemo = new Array(10);
        var colsNumsMemo = new Array(10);
        var blosNumsMemo = new Array(10);
        var nums = NUMS;
        for (var gi = 1; gi <= LEN; gi++) {
            var rowMemo = rowsNumsMemo[gi] = new Array(257);
            var colMemo = colsNumsMemo[gi] = new Array(257);
            var bloMemo = blosNumsMemo[gi] = new Array(257);
            for (var ni = 0; ni < LEN; ni++) {
                var hash = nums[ni];
                rowMemo[hash] = countMemo.rowsMemo[gi][hash];
                colMemo[hash] = countMemo.colsMemo[gi][hash];
                bloMemo[hash] = countMemo.blosMemo[gi][hash];
            }
        }
        return { rowsMemo: rowsNumsMemo, colsMemo: colsNumsMemo, blosMemo: blosNumsMemo };
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