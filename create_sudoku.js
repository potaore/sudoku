var cluster = require("cluster");
var fs = require("fs");
var solver = require("./solve_sudoku.js");

var createQuestion = function (size) {
    var len = 3 * size;
    var getRandomNumber = function () {
        return Math.floor(Math.random() * (size * size)) + 1;
    };
    var getRandomIndex = function () {
        return Math.floor(Math.random() * len);
    };

    var numberOver = 0;
    var callCount1 = 0;
    var invalid = 0;
    while (true) {
        var Q = getVacantQuestion(len);
        var decidedNumberCount = 0;
        var putRandomNumberToQ = function () {
            while (true) {
                var i = getRandomIndex();
                var j = getRandomIndex();
                if (Q[i][j]) continue;
                var number = getRandomNumber();
                Q[i][j] = number;
                if (solver.validateQuestion(Q)) {
                    decidedNumberCount++;
                    return { i: i, j: j, number: number };
                } else {
                    Q[i][j] = 0;
                }
            }
        };
        var putNumberToQByResult = function (result) {
            while (true) {
                var i = getRandomIndex();
                var j = getRandomIndex();
                if (Q[i][j]) continue;
                var number = parseInt(Object.keys(result.memoMap[(i + 1) + "-" + (j + 1)])[0]);
                Q[i][j] = number;
                if (solver.validateQuestion(Q)) {
                    decidedNumberCount++;
                    return { i: i, j: j, number: number };
                } else {
                    Q[i][j] = 0;
                }
            }
        };

        while (decidedNumberCount <= 20) {
            putRandomNumberToQ();
        }
        var loopCount = 0;
        var putMemo;
        var result;
        var findQuestion = false;
        var beforeBranchMemoMap = null;
        while (true) {
            loopCount++;
            solver.clearInformations();
            result = solver.solveSudoku(Q, 1, true, beforeBranchMemoMap);
            if (result.result) {
                if (result.dup) {
                    putMemo = putNumberToQByResult(result);
                    beforeBranchMemoMap = result.beforeBranchMemoMap;
                    if (decidedNumberCount >= 26) {
                        numberOver++;
                        console.log("num over : " + numberOver);
                        break;
                    } else if (solver.getInformations().callCount < 50) {
                        console.log("less callCount : " + numberOver);
                        break;
                    }
                    continue
                } else {
                    findQuestion = true;
                    break;
                }
            } else {
                if (loopCount == 1) {
                    invalid++;
                    break
                }
                console.log("err : " + loopCount + " : " + decidedNumberCount);
                Q[putMemo.i][putMemo.j] = 0;
                putMemo = putRandomNumberToQ();
                decidedNumberCount--;
            }
        }

        var info = solver.getInformations();
        if (findQuestion) {
            console.log(info.callCount);

            //console.log("loopCount  : " + loopCount);
            //console.log("numberOver : " + numberOver);
            //console.log("callCount1 : " + callCount1);
            //console.log("invalid    : " + invalid);
            if (info.callCount > 50) break;
        } else {
            if (info.callCount == 1) callCount1++;
        }
    }
    var info = solver.getInformations();
    info.decidedNumberCount = decidedNumberCount;
    //console.log(info);
    //console.log(JSON.stringify(Q));
    //console.log();

    return [Q, info];
};

var getVacantQuestion = function (len) {
    var Q = [];
    for (var i = 0; i < len; i++) {
        Q.push([]);
        for (var j = 0; j < len; j++) {
            Q[i].push(0);
        }
    }
    return Q;
};



var createQuestions = function (num, parallel, id) {
    var questions = [];
    var infoList = [];

    for (var i = 0; i < num; i++) {
        var res = createQuestion(3);
        questions.push(res[0]);
        infoList.push(res[1]);
        console.log(id + " : " + (i + 1) + " / " + num)
    }

    if (!parallel) {
        try {
            writeQuestionsAndInfo(questions, infoList);
            console.log("questions.json created");
        } catch (e) {
            console.log(e);
        }
    }
    return [questions, infoList];
};

var writeQuestionsAndInfo = function (questions, infoList) {
    fs.writeFileSync("questions.json", JSON.stringify(questions));
    fs.writeFileSync("questions_info.json", JSON.stringify(infoList));
    var str = getMemoStringFromInfoList(infoList);
    fs.writeFileSync("questions_info.txt", str);
};

var getMemoStringFromInfoList = function (infoList) {
    var str = "No\tCallCount\tDecidedNumber\tMaxDepth\tLoop\tDecideCandidate\tSingleNumber\tGroupStraddle\tGroupConstraint\tGroupPatterns";
    for (var idx in infoList) {
        str += "\n";
        info = infoList[idx];
        str += (parseInt(idx) + 1) + "\t";
        str += info.callCount + "\t";
        str += info.maxDepth + "\t";
        str += info.loopCount + "\t";
        str += info.decideCandidateRemoveCount + "\t";
        str += info.findSingleNumberRemoveCount + "\t";
        str += info.groupStraddleRemoveCount + "\t";
        str += info.groupConstraintRemoveCount + "\t";
        str += info.groupPatternsRemoveCount;
    }
    return str;
};

function createQuestionParallel(num, workerNum) {
    var questions = [];
    var infoList = [];
    cluster.on('exit', function (worker, code, signal) {
        console.log('worker exit : ', worker.id);
        for (var id in cluster.workers) {
            return;
        }
        writeQuestionsAndInfo(questions, infoList);
        console.log('finish!!');
    });

    cluster.on('fork', function (worker) {
        // workerに送信
        worker.send({ id: worker.id, signal: 'CreateQuestions', num: num });
        // workerから終了通知を受け取る
        worker.on('message', function (msg) {
            var w = cluster.workers[msg.id];
            questions = questions.concat(msg.result[0]);
            infoList = infoList.concat(msg.result[1]);
            w.send({
                id: w.id,
                signal: 'exit'
            });
        });
    });

    for (var i = 0; i < workerNum; i++) {
        cluster.fork();
    }
}

if (cluster.isWorker) {
    process.on('message', function (m) {
        if (m.signal === 'exit') {
            // masterから終了通知されたらworkerをexit
            return process.exit(0);
        }
        // workerの処理
        var result = createQuestions(m.num, true, m.id);
        //console.log("test " + m.id + "-" + m.num )
        process.send({ id: m.id, status: 'finish', result: result });
    });

    return;
}

//console.time();
createQuestions(1);
//console.timeEnd();
//createQuestionParallel(100, 10);