var exports = exports;
if (!exports) exports = {};
var solver = exports;
(function () {
    var version = "1.6.3";
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
    var hashMemo = [], hashMemoLog2 = [], hashLengthMemo = [];
    var groupIds = { rows: new Array(9), cols: new Array(9), blos: new Array(9) };
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

        var gid = 1;
        for (var gi = 0; gi < LEN; gi++) {
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
        for (var i = 0; i < LEN; i++) {
            for (var j = 0; j < LEN; j++) {
                var k = Math.floor(j / 3) + Math.floor(i / 3) * 3;
                var bo = j % 3 + (i % 3) * 3;
                var cellName = cellNames[i][j];
                var cell = {
                    key: cellName, i: i, j: j, k: k,
                    idx: [i, j, k],
                    //rohash: 1 << (j - 1), cohash: 1 << (i - 1), bohash: 1 << bo,
                    rhash: groupIds.rows[i], chash: groupIds.cols[j], bhash: groupIds.blos[k],
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
                strongLinkChain: 0
            },
            cost: {
                singleNumberPattern: 0,
                biValueChain: 0,
                nakedTriplet: 0,
                hiddenPair: 0,
                hiddenTriplet: 0,
                intersection: 0,
                strongLinkChain: 0
            },
            removeCountPerMs: {
                singleNumberPattern: 0,
                biValueChain: 0,
                nakedTriplet: 0,
                hiddenPair: 0,
                hiddenTriplet: 0,
                intersection: 0,
                strongLinkChain: 0
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
        f.removeCountPerMs.strongLinkChain = pf.calcPerMs(f.removeCount.strongLinkChain, f.cost.strongLinkChain);
        return infomations;
    };

    var analizeSudoku = function (q) {
        if (!validateQuestion(q)) return { result: false, dup: false, invalid: true, memoMap: getNewMemoMap(), countMemo: null };
        return solveSudoku(transformQToBit(q), 1, null, null, null);
    };

    var transformQToBit = function (q) {
        var bq = new Array(81);
        var index = 0;
        for (var i = 0; i < 9; i++) {
            for (var j = 0; j < 9; j++) {
                var num = q[i][j];
                if (num) {
                    bq[index] = 1 << (num - 1);
                } else {
                    bq[index] = 0;
                }
                index++;
            }
        }
        return bq;
    };

    var solveSudoku = function (q, depth, memoMap, countMemo, temps) {
        infomations.callCount++;
        if (depth > infomations.maxDepth) infomations.maxDepth = depth;
        var useMemoMap = false;
        if (!memoMap) {
            memoMap = getNewMemoMap();
            countMemo = { rows: new Array(9), cols: new Array(9), blos: new Array(9) };
        } else {
            useMemoMap = true;
        }
        var numsLeft = new Array(257); numsLeft[1] = numsLeft[2] = numsLeft[4] = numsLeft[8] = numsLeft[16] = numsLeft[32] = numsLeft[64] = numsLeft[128] = numsLeft[256] = 9;
        var $g = {
            leftCount: 81,
            memoMap: memoMap,
            rows: [[], [], [], [], [], [], [], [], []],
            cols: [[], [], [], [], [], [], [], [], []],
            blos: [[], [], [], [], [], [], [], [], []],
            rowsMemo: [511, 511, 511, 511, 511, 511, 511, 511, 511],
            colsMemo: [511, 511, 511, 511, 511, 511, 511, 511, 511],
            blosMemo: [511, 511, 511, 511, 511, 511, 511, 511, 511],
            countMemo: countMemo,
            numsLeft: numsLeft,
            biValueChainQueue: [],
            strongLinkCache: {
                rows: [511, 511, 511, 511, 511, 511, 511, 511, 511],
                cols: [511, 511, 511, 511, 511, 511, 511, 511, 511],
                blos: [511, 511, 511, 511, 511, 511, 511, 511, 511]
            },
            removedNhashForNP: 0,
            removedGhashForNT: 0,
            removedGhashForHT: 0,
            removedGhashForHP: 0,
            removedGhashForIS: 0
        };

        initQuestion(memoMap, $g, useMemoMap);

        var removeCount = 0;
        var result = { removeCount: 0 };
        var solved = false;

        for (var index = 0; index < 81; index++) {
            if (q[index]) deleteAllCandedatesInitQ($g, $g.memoMap[index], q[index]);
        }
        $g.removedGhashForHT = $g.removedGhashForHP = $g.removedGhashForIS = $g.removedGhashForNT;

        index = 0;
        for (var index = 0; index < 81; index++) {
            if (q[index]) {
                var cnds = $g.memoMap[index];
                if (cnds.ok) continue;
                var skip = false;
                if (depth !== 1) {
                    for (var ti = 0; ti < temps.length; ti++) {
                        if (!(skip = temps[ti].cell.key !== cnds.cell.key)) break;
                    }
                }
                if (!decideCandidates($g, cnds.cell.key, q[index], result, skip)) return endAsError(memoMap);
            }
        }

        if (depth > 1) {
            for (var ti = 0; ti < temps.length; ti++) {
                var cell = temps[ti].cell;
                for (var ni = 0; ni < 9; ni++) {
                    var num = 1 << ni;
                    if (($g.rowsMemo[cell.i] & num) && $g.countMemo.rows[cell.i][num] === 1) {
                        if (!decideSingleNumberInList($g, $g.rows[cell.i], num, result)) return false;
                    }
                    if (($g.colsMemo[cell.j] & num) && $g.countMemo.cols[cell.j][num] === 1) {
                        if (!decideSingleNumberInList($g, $g.cols[cell.j], num, result)) return false;
                    }
                    if (($g.blosMemo[cell.k] & num) && $g.countMemo.blos[cell.k][num] === 1) {
                        if (!decideSingleNumberInList($g, $g.blos[cell.k], num, result)) return false;
                    }
                }
            }
        }

        infomations.removeCount.decideCandidate += result.removeCount;
        var checkPoint = 0;
        var outerCheckpoint = 0;
        if ($g.leftCount === 0) solved = true;
        var start = 0;
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
                else if (++checkPoint >= 4) break;
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
                else if (++checkPoint >= 4) break;
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
                else if (++checkPoint >= 4) break;
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
                else if (++checkPoint >= 4) break;
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

            start = pf.start();
            if (!removeByStrongLinkChain($g, result)) return endAsError(memoMap);
            infomations.cost.strongLinkChain += pf.end(start);
            removeCount += result.removeCount;
            infomations.removeCount.strongLinkChain += result.removeCount;
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
                return { result: true, dup: false, invalid: false, memoMap: memoMap, countMemo: $g.countMemo, secondResult: null };
            } else {
                return endAsError(memoMap);
            }
        } else {
            var useDoubleTemporary = false;
            if (45 <= $g.leftCount && $g.leftCount <= 64) {
                var leftCount = 0;
                for (var ii = 0; ii < 9; ii++)
                    for (var jj = 0; jj < 9; jj++)
                        leftCount += $g.countMemo.rows[ii][1 << jj];
                useDoubleTemporary = leftCount >= 230;
            }

            var patterns = [];
            var minNum = 100;
            var candidates = null;
            if (useDoubleTemporary) {
                var mlCnd1 = null;
                var mlCnd2 = null;
                for (var ai = 0; ai < 81; ai++) {
                    candidates = $g.memoMap[ai];
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
                    } else if (num === minNum) {
                        mlCnd2 = candidates;
                    }
                }

                var nums1 = hashMemo[mlCnd1.hash];
                var nums2 = hashMemo[mlCnd2.hash];
                for (var ni1 = 0, nlen1 = nums1.length; ni1 < nlen1; ni1++) {
                    for (var ni2 = 0, nlen2 = nums2.length; ni2 < nlen2; ni2++) {
                        if (nums1[ni1] === nums2[ni2] && (mlCnd1.cell.ghash & mlCnd2.cell.ghash)) continue;
                        patterns.push([
                            { cell: mlCnd1.cell, num: nums1[ni1] },
                            { cell: mlCnd2.cell, num: nums2[ni2] },
                        ]);
                    }
                }
            } else {
                var mlCnd = null;
                for (var ai = 0; ai < 81; ai++) {
                    candidates = $g.memoMap[ai];
                    if (candidates.ok) continue;
                    var num = candidates.len;
                    if (num < minNum) {
                        minNum = num;
                        mlCnd = candidates;
                        if (num === 2) break;
                    }
                }
                var nums = hashMemo[mlCnd.hash];
                for (var ni = 0, nlen = nums.length; ni < nlen; ni++)
                    patterns.push([{ cell: mlCnd.cell, num: nums[ni] }]);
            }

            var firstResult = null;
            for (var index = patterns.length - 1; index >= 0; index--) {
                var pattern = patterns[index];
                var newQ = createQuestionFromMemoMap($g, memoMap, pattern);
                var result = solveSudoku(newQ[0], depth + 1, newQ[1], newQ[2], pattern);

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
        if (!useMemoMap) initQuestionSub($g);
        var cells = allCells;
        for (var cli = 0; cli < 81; cli++) {
            var cell = cells[cli];
            var cnds = memoMap[cli];
            $g.rows[cell.i].push(cnds);
            $g.cols[cell.j].push(cnds);
            $g.blos[cell.k].push(cnds);
        }
    };

    var initQuestionSub = function ($g) {
        var rowsNumsMemo = $g.countMemo.rows;
        var colsNumsMemo = $g.countMemo.cols;
        var blosNumsMemo = $g.countMemo.blos;
        for (var gi = 0; gi < 9; gi++) {
            var rowMemo = rowsNumsMemo[gi] = new Array(257);
            var colMemo = colsNumsMemo[gi] = new Array(257);
            var bloMemo = blosNumsMemo[gi] = new Array(257);
            for (var ni = 0; ni < 9; ni++) {
                var hash = 1 << ni;
                rowMemo[hash] = 9;
                colMemo[hash] = 9;
                bloMemo[hash] = 9;
            }
        }
    };

    var getNewMemoMap = function () {
        var cells = allCells;
        var memoMap = new Array(81);
        for (var i = 0; i < 81; i++)
            memoMap[i] = createCandidates(511, 9, cells[i]);
        return memoMap;
    };

    var createCandidates = function (hash, len, cell) {
        return { hash: hash, len: len, cell: cell, ok: false };
    };

    var deleteAllCandedatesInitQ = function ($g, cnds, decidedNum) {
        for (var delNums = hashMemo[cnds.hash - decidedNum], i = 0, len = delNums.length; i < len; i++) {
            deleteCandidateInitQ($g, cnds, delNums[i]);
        }
    };

    var deleteCandidateInitQ = function ($g, cnds, delNum) {
        cnds.hash -= delNum;
        cnds.len--;
        $g.countMemo.rows[cnds.cell.i][delNum]--;
        $g.countMemo.cols[cnds.cell.j][delNum]--;
        $g.countMemo.blos[cnds.cell.k][delNum]--;
        $g.removedNhashForNP |= delNum;
        $g.removedGhashForNT |= cnds.cell.ghash;
    };

    var deleteAllCandedates = function ($g, cnds, decidedNum, result) {
        if (cnds.ok) return decidedNum === cnds.hash;
        var len = cnds.len;
        if (len === 1) return decideCandidates($g, cnds.cell.key, decidedNum, result, false);

        var cndsNums = hashMemo[cnds.hash - decidedNum];
        for (var ni = 0; ni < len; ni++) {
            if (cnds.hash & cndsNums[ni]) {
                if (deleteCandidate($g, cnds, cndsNums[ni], result, true)) {
                    if (cnds.ok) break;
                } else {
                    return false;
                }
            }
        }
        return true;
    };

    var deleteCandidate = function ($g, cnds, delNum, result, allDelete) {
        result.removeCount++;
        cnds.hash -= delNum;
        cnds.len--;
        var cell = cnds.cell;
        var row = $g.countMemo.rows[cell.i];
        var col = $g.countMemo.cols[cell.j];
        var blo = $g.countMemo.blos[cell.k];
        $g.removedNhashForNP |= delNum;
        $g.removedGhashForNT |= cell.ghash;
        $g.removedGhashForHT |= cell.ghash;
        $g.removedGhashForHP |= cell.ghash;
        $g.removedGhashForIS |= cell.ghash;

        if (--row[delNum] === 0
            || --col[delNum] === 0
            || --blo[delNum] === 0
            || cnds.hash === 0) return false;
        if (cnds.len === 1)
            if (!decideCandidates($g, cell.key, cnds.hash, result, false)) return false;

        if (row[delNum] === 1 && ($g.rowsMemo[cell.i] & delNum))
            if (!decideSingleNumberInList($g, $g.rows[cell.i], delNum, result)) return false;

        if (col[delNum] === 1 && ($g.colsMemo[cell.j] & delNum))
            if (!decideSingleNumberInList($g, $g.cols[cell.j], delNum, result)) return false;

        if (blo[delNum] === 1 && ($g.blosMemo[cell.k] & delNum))
            if (!decideSingleNumberInList($g, $g.blos[cell.k], delNum, result)) return false;

        if (cnds.len === 2) {
            if (!allDelete) {
                if (!removeByNakedPairPropagation($g, $g.rows[cell.i], cnds, result)) return false;
                if (cnds.len === 2)
                    if (!removeByNakedPairPropagation($g, $g.cols[cell.j], cnds, result)) return false;
                if (cnds.len === 2)
                    if (!removeByNakedPairPropagation($g, $g.blos[cell.k], cnds, result)) return false;
                if (cnds.len === 2) $g.biValueChainQueue.push(cnds);
            }
        }
        return true;
    };

    var endAsError = function (memoMap) {
        return { result: false, dup: false, invalid: true, memoMap: memoMap, countMemo: null, secondResult: null };
    };

    var decideCandidates = function ($g, key, decidedNum, result, skip) {
        $g.leftCount--;
        $g.numsLeft[decidedNum]--;
        var cnds = $g.memoMap[key];
        var cell = cnds.cell;
        var row = $g.rows[cell.i];
        row.splice(row.indexOf(cnds), 1);
        var col = $g.cols[cell.j];
        col.splice(col.indexOf(cnds), 1);
        var blo = $g.blos[cell.k];
        blo.splice(blo.indexOf(cnds), 1);
        $g.rowsMemo[cell.i] -= decidedNum;
        $g.colsMemo[cell.j] -= decidedNum;
        $g.blosMemo[cell.k] -= decidedNum;
        cnds.ok = true;
        if (skip) return true;
        return removeCandidatesFromList($g, row, decidedNum, result)
            && removeCandidatesFromList($g, col, decidedNum, result)
            && removeCandidatesFromList($g, blo, decidedNum, result);
    };

    var removeCandidatesFromList = function ($g, list, decidedNum, result) {
        for (var li = 0, llen = list.length; li < llen; li++) {
            if (list[li].hash & decidedNum) {
                if (deleteCandidate($g, list[li], decidedNum, result, false)) {
                    if (llen !== list.length && llen !== li + 1) {
                        li = -1;
                        llen = list.length;
                    }
                } else {
                    return false;
                }
            }
        }
        return true;
    };

    var decideSingleNumberInList = function ($g, list, num, result) {
        for (var i = 0, llen = list.length; i < llen; i++) {
            if (list[i].hash & num)
                return deleteAllCandedates($g, list[i], num, result);
        }
        return false;
    };

    var removeByNakedPairPropagation = function ($g, group, cnds, result) {
        var glen = group.length;
        if (glen <= 2) return true;
        for (var i = 0; i < glen; i++) {
            var tcnds = group[i];
            if (cnds.hash === tcnds.hash && cnds !== tcnds) {
                var nums = hashMemo[cnds.hash];
                for (var i = 0; i < glen; i++) {
                    var ocnds = group[i];
                    if (ocnds !== tcnds && ocnds !== cnds) {
                        if (ocnds.hash & nums[0])
                            if (!deleteCandidate($g, ocnds, nums[0], result, false)) return false;
                        if (ocnds.hash & nums[1])
                            if (!deleteCandidate($g, ocnds, nums[1], result, false)) return false;
                        if (group.length !== glen && glen !== i + 1) {
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
        var removeCache = 0;
        for (var gi = 0; gi < 9; gi++) {
            if ($g.removedGhashForNT & groupIds.rows[gi]) {
                removeCache = result.removeCount;
                if (!removeByNakedTripletSub($g, $g.rows[gi], result)) return false;
                if (removeCache === result.removeCount) $g.removedGhashForNT -= groupIds.rows[gi];
            }
            if ($g.removedGhashForNT & groupIds.cols[gi]) {
                removeCache = result.removeCount;
                if (!removeByNakedTripletSub($g, $g.cols[gi], result)) return false;
                if (removeCache === result.removeCount) $g.removedGhashForNT -= groupIds.cols[gi];
            }
            if ($g.removedGhashForNT & groupIds.blos[gi]) {
                removeCache = result.removeCount;
                if (!removeByNakedTripletSub($g, $g.blos[gi], result)) return false;
                if (removeCache === result.removeCount) $g.removedGhashForNT -= groupIds.blos[gi];
            }
        }
        return true;
    }

    var removeByNakedTripletSub = function ($g, group, result) {
        var glen = group.length;
        if (glen <= 3) return true;

        for (var i1 = 0; i1 < glen - 2; i1++) {
            var c1 = group[i1];
            if (c1.len > 3) continue;
            for (var i2 = i1 + 1; i2 < glen - 1; i2++) {
                var c2 = group[i2];
                if (hashLengthMemo[(c1.hash | c2.hash)] > 3) continue;
                for (var i3 = i2 + 1; i3 < glen; i3++) {
                    var c3 = group[i3];
                    var nums = hashMemo[(c1.hash | c2.hash | c3.hash)];
                    if (nums.length <= 3) {
                        for (var i = 0; i < glen; i++) {
                            var cnds = group[i];
                            if (cnds !== c1 && cnds !== c2 && cnds !== c3) {
                                for (var ni = 0, nlen = nums.length; ni < nlen; ni++) {
                                    if (cnds.ok) break;
                                    if (cnds.hash & nums[ni])
                                        if (!deleteCandidate($g, cnds, nums[ni], result, false)) return false;
                                }
                                if (group.length !== glen && glen !== i + 1) {
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
        for (var i = 0; i < 9; i++) {
            var num = 1 << i;
            if ($g.removedNhashForNP & num) {
                var removeCountCache = result.removeCount;
                if (!removeBySingleNumberPatternSub($g, num, result)) return false;
                if (removeCountCache === result.removeCount) $g.removedNhashForNP -= num;
            }
        }
        return true;
    };

    var removeBySingleNumberPatternSub = function ($g, num, result) {
        if ($g.numsLeft[num] < 2 || $g.numsLeft[num] === 9) return true;
        var numberLeftCells = [];
        var numberLeftBlos = [];
        var bKeys = [];
        for (var k = 0; k < 9; k++) {
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
        var firstBlosLenM1 = numberLeftBlos[0].length - 1;
        var firstBkey = bKeys[0];
        var ghashHistory = [];
        for (var li = 0, len = numberLeftCells.length; li < len; li++) {
            var target = numberLeftCells[li];
            if (!(target.hash & num)) continue;
            if (target.ok) continue;
            setArrayAllZero(indexes, blen);
            currrentBkey = target.cell.k;
            var occupiedGroups = target.cell.ghash;
            for (var bKeyIndex = 0; bKeyIndex < blen;) {
                if (currrentBkey === bKeys[bKeyIndex]) {
                    bKeyIndex++;
                    continue;
                }
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
                    bKeyIndex++;
                    continue;
                } else {
                    if (bKeyIndex === 0 ||
                        (bKeyIndex === 1 && (indexes[0] >= firstBlosLenM1 || currrentBkey === firstBkey))) {
                        if (deleteCandidate($g, target, num, result, false)) break;
                        else return false;
                    }
                    indexes[bKeyIndex] = 0;
                    occupiedGroups = ghashHistory.pop();
                    bKeyIndex--;
                    if (currrentBkey === bKeys[bKeyIndex]) bKeyIndex--;
                    indexes[bKeyIndex]++;
                }
            }
        }
        return true;
    };

    var getAllZeroArray = function (len) {
        var array = new Array(len);
        for (var i = 0; i < len; i++) array[i] = 0;
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
            if (!removeByChainResult($g,
                getChainResult($g, cnds, cnds, bival[0], bival[1]),
                getChainResult($g, cnds, cnds, bival[1], bival[0]), result)) return false;
        }
        return true;
    };

    var removeByChainResult = function ($g, first, second, result) {
        if (first.err && second.err) return false;
        if (first.err) {
            return removeByTrueResult($g, second, result);
        } else if (second.err) {
            return removeByTrueResult($g, first, result);
        } else {
            return removeByChainResultSub($g, first, second, result);
        }
    };

    var removeByTrueResult = function ($g, trueResult, result) {
        var keys = trueResult.onKeysList;
        for (var i = 0, len = keys.length; i < len; i++) {
            if (!deleteAllCandedates($g, $g.memoMap[keys[i]], trueResult.onKeys[keys[i]], result)) return false;
        }
        return true;
    }

    var removeByChainResultSub = function ($g, first, second, result) {
        var fkeys = first.onKeysList;
        for (var fi = 0, flen = fkeys.length; fi < flen; fi++) {
            var fkey = fkeys[fi];
            if (first.onKeys[fkey] === second.onKeys[fkey])
                if (!deleteAllCandedates($g, $g.memoMap[fkey], first.onKeys[fkey], result)) return false;
        }

        var fkeys = first.offKeysList;
        var offNumHash = 0;
        for (var fi = 0, flen = fkeys.length; fi < flen; fi++) {
            var fkey = fkeys[fi];
            if (offNumHash = first.offKeys[fkey] & second.offKeys[fkey]) {
                var hash = $g.memoMap[fkey].hash;
                for (var ni = 0, nums = hashMemo[hash & offNumHash], nlen = nums.length; ni < nlen; ni++) {
                    if (hash & nums[ni]) {
                        if (!deleteCandidate($g, $g.memoMap[fkey], nums[ni], result, false)) return false;
                    }
                }
            }
        }
        return true;
    }

    var getNumsRecords;
    var getOffNumsRecord;
    (function () {
        var numsRecords = new Array(257);
        var offNumsRecord = {
            rows: new Array(9),
            cols: new Array(9),
            blos: new Array(9)
        };

        for (var gi = 0; gi < 9; gi++) {
            offNumsRecord.rows[gi] = new Array(257);
            offNumsRecord.cols[gi] = new Array(257);
            offNumsRecord.blos[gi] = new Array(257);
        }
        getOffNumsRecord = function () {
            for (var ni = 0; ni < 9; ni++) {
                var num = 1 << ni;
                for (var gi = 0; gi < 9; gi++) {
                    offNumsRecord.rows[gi][num] = 0;
                    offNumsRecord.cols[gi][num] = 0;
                    offNumsRecord.blos[gi][num] = 0;
                }
            }
            return offNumsRecord;
        };
        getNumsRecords = function () {
            for (var ni = 0; ni < 9; ni++) {
                numsRecords[1 << ni] = 0;
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
        if (addChainResultOn($g, onCandidates, onNum, chainResult)) {
            chainResult.err = true;
            return chainResult;
        }
        if (addChainResultOff($g, offCandidates, offNum, chainResult)) {
            chainResult.err = true;
            return chainResult;
        }
        return chainResult;
    };

    var addChainResultOn = function ($g, cnds, onNum, chainResult) {
        if (addChainResult(chainResult, cnds.cell, onNum)) return true;
        if (propagateAddChainResultOn($g, cnds, $g.rows[cnds.cell.i], onNum, chainResult)) return true;
        if (propagateAddChainResultOn($g, cnds, $g.cols[cnds.cell.j], onNum, chainResult)) return true;
        if (propagateAddChainResultOn($g, cnds, $g.blos[cnds.cell.k], onNum, chainResult)) return true;
        return false;
    };

    var propagateAddChainResultOn = function ($g, cnds, group, onNum, chainResult) {
        for (var gi = 0, glen = group.length; gi < glen; gi++) {
            var gcnds = group[gi];
            if (gcnds === cnds) continue;
            if (gcnds.hash & onNum) {
                if (addChainResultOff($g, gcnds, onNum, chainResult)) return true;
            }
        }
        return false;
    };

    var addChainResultOff = function ($g, cnds, offNum, chainResult) {
        var key = cnds.cell.key;
        if (chainResult.offKeys[key]) {
            if (chainResult.offKeys[key] & offNum) return false;
            chainResult.offKeys[key] += offNum;
        } else {
            chainResult.offKeys[key] = offNum;
            chainResult.offKeysList.push(key);
        }

        var leftNums = cnds.hash - chainResult.offKeys[key];
        if (leftNums === 0) return true;
        if (hashLengthMemo[leftNums] === 1) {
            if (chainResult.onKeys[key]) {
                if (chainResult.onKeys[key] !== leftNums) return true;
            } else {
                if (addChainResultOn($g, cnds, leftNums, chainResult)) return true;
            }
        }

        if ($g.countMemo.rows[cnds.cell.i][offNum] - ++chainResult.offNumsRecord.rows[cnds.cell.i][offNum] === 1)
            if (addChainResultOffGroups($g, $g.rows[cnds.cell.i], offNum, chainResult)) return true;

        if ($g.countMemo.cols[cnds.cell.j][offNum] - ++chainResult.offNumsRecord.cols[cnds.cell.j][offNum] === 1)
            if (addChainResultOffGroups($g, $g.cols[cnds.cell.j], offNum, chainResult)) return true;

        if ($g.countMemo.blos[cnds.cell.k][offNum] - ++chainResult.offNumsRecord.blos[cnds.cell.k][offNum] === 1)
            if (addChainResultOffGroups($g, $g.blos[cnds.cell.k], offNum, chainResult)) return true;

        return false;
    };

    var addChainResultOffGroups = function ($g, group, offNum, chainResult) {
        for (var gi = 0, glen = group.length; gi < glen; gi++) {
            var gcnds = group[gi];
            if (chainResult.offKeys[gcnds.cell.key] & offNum) continue;
            if (gcnds.hash & offNum) {
                if (chainResult.onKeys[gcnds.cell.key]) {
                    if (chainResult.onKeys[gcnds.cell.key] !== offNum) return true;
                } else {
                    if (addChainResultOn($g, gcnds, offNum, chainResult)) return true;
                    for (var offNums = hashMemo[gcnds.hash - offNum], ni = 0, ofnlen = offNums.length; ni < ofnlen; ni++) {
                        if (addChainResultOff($g, gcnds, offNums[ni], chainResult)) return true;
                    }
                }
                return false;
            }
        }
        return true;
    };

    var addChainResult = function (chainResult, cell, num) {
        if (chainResult.numsRecords[num] & cell.ghash) return true;
        chainResult.numsRecords[num] |= cell.ghash;
        chainResult.onKeys[cell.key] = num;
        chainResult.onKeysList.push(cell.key);
        return false;
    };

    var removeByHiddenPair = function ($g, result) {
        var removeCache = 0;
        for (var gi = 0; gi < 9; gi++) {
            if ($g.removedGhashForHP & groupIds.rows[gi]) {
                removeCache = result.removeCount;
                if (!removeByHiddenPairSub($g, $g.rows[gi], $g.countMemo.rows[gi], result)) return false;
                if (removeCache === result.removeCount) $g.removedGhashForHP -= groupIds.rows[gi];
            }
            if ($g.removedGhashForHP & groupIds.cols[gi]) {
                removeCache = result.removeCount;
                if (!removeByHiddenPairSub($g, $g.cols[gi], $g.countMemo.cols[gi], result)) return false;
                if (removeCache === result.removeCount) $g.removedGhashForHP -= groupIds.cols[gi];
            }
            if ($g.removedGhashForHP & groupIds.blos[gi]) {
                removeCache = result.removeCount;
                if (!removeByHiddenPairSub($g, $g.blos[gi], $g.countMemo.blos[gi], result)) return false;
                if (removeCache === result.removeCount) $g.removedGhashForHP -= groupIds.blos[gi];
            }
        }
        return true;
    }

    var removeByHiddenPairSub = function ($g, group, numsMemo, result) {
        var glen = group.length;
        if (glen <= 2) return true;
        var pairNumsCollectionHash = 0;
        var num = 0;
        for (var ni = 0; ni < 9; ni++) {
            if (numsMemo[num = 1 << ni] === 2) pairNumsCollectionHash += num;
        }
        var pnclen = hashLengthMemo[pairNumsCollectionHash];
        if (pnclen < 2) return true;
        var pairNums = hashMemo[pairNumsCollectionHash];
        for (var n1i = 0, n1len = pnclen - 1; n1i < n1len; n1i++) {
            var n1 = pairNums[n1i];
            for (var n2i = n1i + 1; n2i < pnclen; n2i++) {
                var pairNumsHash = n1 + pairNums[n2i];
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
                var delNums = hashMemo[fcnds.hash - pairNumsHash];
                for (var i = 0, len = delNums.length; i < len; i++)
                    if (fcnds.hash & delNums[i])
                        if (!deleteCandidate($g, fcnds, delNums[i], result, false)) return false;
                delNums = hashMemo[scnds.hash - (scnds.hash & pairNumsHash)];
                for (i = 0, len = delNums.length; i < len; i++)
                    if (scnds.hash & delNums[i])
                        if (!deleteCandidate($g, scnds, delNums[i], result, false)) return false;
                return true;
            }
        }
        return true;
    };

    var removeByHiddenTriplet = function ($g, result) {
        var removeCache = 0;
        for (var gi = 0; gi < 9; gi++) {
            if ($g.removedGhashForHT & groupIds.rows[gi]) {
                removeCache = result.removeCount;
                if (!removeByHiddenTripletSub($g, $g.rows[gi], $g.countMemo.rows[gi], result)) return false;
                if (removeCache === result.removeCount) $g.removedGhashForHT -= groupIds.rows[gi];
            }
            if ($g.removedGhashForHT & groupIds.cols[gi]) {
                removeCache = result.removeCount;
                if (!removeByHiddenTripletSub($g, $g.cols[gi], $g.countMemo.cols[gi], result)) return false;
                if (removeCache === result.removeCount) $g.removedGhashForHT -= groupIds.cols[gi];
            }
            if ($g.removedGhashForHT & groupIds.blos[gi]) {
                removeCache = result.removeCount;
                if (!removeByHiddenTripletSub($g, $g.blos[gi], $g.countMemo.blos[gi], result)) return false;
                if (removeCache === result.removeCount) $g.removedGhashForHT -= groupIds.blos[gi];
            }
        }
        return true;
    }

    var removeByHiddenTripletSub = function ($g, group, numsMemo, result) {
        var glen = group.length;
        if (glen <= 3) return true;
        var triNumsCollectionHash = 0;
        var num = 0;
        for (var ni = 0; ni < 9; ni++) {
            if (numsMemo[num = 1 << ni] === 2 || numsMemo[num] === 3) triNumsCollectionHash += num;
        }
        var tnclen = hashLengthMemo[triNumsCollectionHash];
        if (tnclen < 3) return true;
        var triNums = hashMemo[triNumsCollectionHash];
        for (var n1i = 0, n1len = tnclen - 2; n1i < n1len; n1i++) {
            var n1 = triNums[n1i];
            for (var n2i = n1i + 1; n2i < tnclen - 1; n2i++) {
                var n2 = triNums[n2i];
                for (var n3i = n2i + 1; n3i < tnclen; n3i++) {
                    var triNumsHash = n1 + n2 + triNums[n3i];
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
                    if (tcnds === null) continue;
                    var delNums = hashMemo[fcnds.hash - (fcnds.hash & triNumsHash)];
                    for (var i = 0, len = delNums.length; i < len; i++)
                        if (fcnds.hash & delNums[i])
                            if (!deleteCandidate($g, fcnds, delNums[i], result, false)) return false;
                    delNums = hashMemo[scnds.hash - (scnds.hash & triNumsHash)];
                    for (i = 0, len = delNums.length; i < len; i++)
                        if (scnds.hash & delNums[i])
                            if (!deleteCandidate($g, scnds, delNums[i], result, false)) return false;
                    delNums = hashMemo[tcnds.hash - (tcnds.hash & triNumsHash)];
                    for (i = 0, len = delNums.length; i < len; i++)
                        if (tcnds.hash & delNums[i])
                            if (!deleteCandidate($g, tcnds, delNums[i], result, false)) return false;
                    return true;
                }
            }
        }
        return true;
    };

    var flipped = true;
    var removeByIntersection = function ($g, result) {
        var cm = $g.countMemo;
        var removeCache = 0;
        for (var gi = 0; gi < 9; gi++) {
            var rowsMemo = cm.rows[gi];
            var colsMemo = cm.cols[gi];
            var blosMemo = cm.blos[gi];
            if (flipped) {
                if ($g.removedGhashForIS & groupIds.rows[gi]) {
                    removeCache = result.removeCount;
                    for (var ni = 0; ni < 9; ni++) {
                        var num = 1 << ni;
                        if (rowsMemo[num] === 2 || rowsMemo[num] === 3)
                            if (!removeByIntersectionSub($g, $g.rows[gi], gi, 0, 2, num, rowsMemo[num], $g.blos, cm.blos, result)) return false;
                        if (colsMemo[num] === 2 || colsMemo[num] === 3)
                            if (!removeByIntersectionSub($g, $g.cols[gi], gi, 1, 2, num, colsMemo[num], $g.blos, cm.blos, result)) return false;
                    }
                    if (removeCache === result.removeCount) $g.removedGhashForIS -= groupIds.rows[gi];
                }
            } else {
                if ($g.removedGhashForIS & groupIds.blos[gi]) {
                    removeCache = result.removeCount;
                    for (var ni = 0; ni < 9; ni++) {
                        var num = 1 << ni;
                        if (blosMemo[num] === 2 || blosMemo[num] === 3)
                            if (!removeByIntersectionSub($g, $g.blos[gi], gi, 2, 0, num, blosMemo[num], $g.rows, cm.rows, result)) return false;
                        if (blosMemo[num] === 2 || blosMemo[num] === 3)
                            if (!removeByIntersectionSub($g, $g.blos[gi], gi, 2, 1, num, blosMemo[num], $g.cols, cm.cols, result)) return false;
                    }
                    if (removeCache === result.removeCount) $g.removedGhashForIS -= groupIds.blos[gi];
                }
            }
        }
        flipped = !flipped;
        return true;
    };

    var removeByIntersectionSub = function ($g, group, gi, gKey, tgKey, num, numCount, tGroups, tGroupMemo, result) {
        var tgi = -1;
        var count = 0;
        for (var i = 0, glen = group.length; i < glen; i++) {
            var cnds = group[i];
            if (cnds.hash & num) {
                count++;
                if (tgi === -1) {
                    tgi = cnds.cell.idx[tgKey];
                    if (tGroupMemo[tgi][num] === numCount) return true;
                } else {
                    if (tgi !== cnds.cell.idx[tgKey]) return true;
                }
                if (count === numCount) break;
            }
        }
        if (count === 0) return false;

        var tGroup = tGroups[tgi];
        for (var i = 0, tglen = tGroup.length; i < tglen; i++) {
            var cnds = tGroup[i];
            if (cnds.cell.idx[gKey] !== gi && (cnds.hash & num)) {
                if (!deleteCandidate($g, cnds, num, result, false)) return false;
                if (tglen !== tGroup.length && i !== tglen - 1) {
                    i = -1;
                    tglen = tGroup.length;
                }
            }
        }
        return true;
    };

    var slcFlip = false;
    var removeByStrongLinkChain = function ($g, result) {
        slcFlip = !slcFlip;
        if (slcFlip) {
            for (var gi = 0; gi < 9; gi++) {
                var rowMemo = $g.countMemo.rows[gi];
                for (var ni = 0; ni < 9; ni++) {
                    var num = 1 << ni;
                    if (rowMemo[num] === 2 && ($g.strongLinkCache.rows[gi] & num)) {
                        if (!removeByStrongLinkChainSub($g, $g.rows[gi], num, result)) return false;
                        $g.strongLinkCache.rows[gi] -= num;
                    }
                }
            }
        } else {
            for (var gi = 0; gi < 9; gi++) {
                var colMemo = $g.countMemo.cols[gi];
                for (var ni = 0; ni < 9; ni++) {
                    var num = 1 << ni;
                    if (colMemo[num] === 2 && ($g.strongLinkCache.cols[gi] & num)) {
                        if (!removeByStrongLinkChainSub($g, $g.cols[gi], num, result)) return false;
                        $g.strongLinkCache.cols[gi] -= num;
                    }
                }
            }
        }
        return true;
    };

    var removeByStrongLinkChainSub = function ($g, group, num, result) {
        var fcnds = null;
        var scnds = null;
        for (var i = 0, len = group.length; i < len; i++) {
            if (group[i].hash & num) {
                if (fcnds) {
                    scnds = group[i];
                    if (scnds.len === 2) return true;
                    break;
                } else {
                    fcnds = group[i];
                    if (fcnds.len === 2) return true;
                }
            }
        }
        if (!scnds) return false;
        return removeByChainResult($g,
            getChainResult($g, fcnds, scnds, num, num),
            getChainResult($g, scnds, fcnds, num, num), result);
    };

    var validateMemoMap;
    (function () {
        var _rows = new Array(9);
        var _cols = new Array(9);
        var _blos = new Array(9);
        validateMemoMap = function (memoMap) {
            var cells = allCells;
            var rows = _rows;
            var cols = _cols;
            var blos = _blos;
            for (var gi = 0; gi < 9; gi++) {
                rows[gi] = 0;
                cols[gi] = 0;
                blos[gi] = 0;
            }

            for (var cli = 0; cli < 81; cli++) {
                var cell = cells[cli];

                var candidates = memoMap[cell.key];
                if (candidates.len !== 1) return false;
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


    var validateQuestion;
    (function () {
        var _rows = new Array(9);
        var _cols = new Array(9);
        var _blos = new Array(9);

        validateQuestion = function (q) {
            var cells = allCells;
            var rows = _rows;
            var cols = _cols;
            var blos = _blos;

            for (var gi = 0; gi < 9; gi++) {
                rows[gi] = 0;
                cols[gi] = 0;
                blos[gi] = 0;
            }
            var i;
            var j;
            var k;
            for (var cli = 0; cli < 81; cli++) {
                var cell = cells[cli];
                var row = rows[i = cell.i];
                var col = cols[j = cell.j];
                var blo = blos[k = cell.k];
                var num;
                if (!(num = q[i][j])) continue;
                num = 1 << num;
                if (row & num || col & num || blo & num) {
                    return false;
                } else {
                    rows[i] |= num;
                    cols[j] |= num;
                    blos[k] |= num;
                }
            }
            return true;
        };
    })();

    var createQuestionFromMemoMap = function ($g, memoMap, pattern) {
        var q = new Array(81);
        for (var index = 0; index < 81; index++) {
            var candidates = memoMap[index];
            if (candidates.len === 1) {
                q[index] = candidates.hash;
            } else {
                q[index] = 0;
            }
        }

        var newMemoMap = copyMemoMap(memoMap);
        var newCountMemo = copyCountMemo($g.countMemo);
        for (var pi = 0, plen = pattern.length; pi < plen; pi++) {
            var temp = pattern[pi];
            var nums = hashMemo[newMemoMap[temp.cell.key].hash - temp.num]
            newMemoMap[temp.cell.key] = createCandidates(temp.num, 1, temp.cell);
            for (var ni = 0, nlen = nums.length; ni < nlen; ni++) {
                var num = nums[ni];
                newCountMemo.rows[temp.cell.i][num]--;
                newCountMemo.cols[temp.cell.j][num]--;
                newCountMemo.blos[temp.cell.k][num]--;
            }
            q[temp.cell.key] = temp.num;
        }
        return [q, newMemoMap, newCountMemo];
    };

    var copyMemoMap = function (memoMap) {
        var newMemoMap = new Array(81);
        for (var i = 0; i < 81; i++) {
            var memo = memoMap[i];
            newMemoMap[i] = createCandidates(memo.hash, memo.len, memo.cell);
        }
        return newMemoMap;
    };

    var copyCountMemo = function (countMemo) {
        var rowsNumsMemo = new Array(9);
        var colsNumsMemo = new Array(9);
        var blosNumsMemo = new Array(9);
        for (var gi = 0; gi < 9; gi++) {
            rowsNumsMemo[gi] = new Array(257);
            colsNumsMemo[gi] = new Array(257);
            blosNumsMemo[gi] = new Array(257);
            for (var ni = 0; ni < 9; ni++) {
                var hash = 1 << ni;
                rowsNumsMemo[gi][hash] = countMemo.rows[gi][hash];
                colsNumsMemo[gi][hash] = countMemo.cols[gi][hash];
                blosNumsMemo[gi][hash] = countMemo.blos[gi][hash];
            }
        }
        return { rows: rowsNumsMemo, cols: colsNumsMemo, blos: blosNumsMemo };
    };

    var memoMapToAnswer = function (memoMap) {
        var answer = [];
        for (var i = 0; i < 9; i++) {
            var row = [];
            for (var j = 0; j < 9; j++) {
                row.push((Math.log2(memoMap[cellNames[i][j]].hash) + 1));
            }
            answer.push(row);
        }
        return answer;
    }

    var memoMapHashToArray = function (memoMap) {
        var memoMapArray = [];
        for (var i = 0; i < 9; i++) {
            var row = [];
            for (var j = 0; j < 9; j++) {
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