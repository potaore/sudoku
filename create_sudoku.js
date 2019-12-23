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

        var iterateRemovedQ = function (Q, func) {
            for (var i = 0; i < len; i++) {
                for (var j = 0; j < len; j++) {
                    if(Q[i][j]) {
                        var rQ = getCopyQuestion(Q, len);
                        rQ[i][j] = 0;
                        func(rQ, i + "-" + j);
                    }
                }
            }
        };

        while (decidedNumberCount <= 16) {
            putRandomNumberToQ();
        }
        var loopCount = 0;
        var putMemo;
        var removeMemo;
        var result;
        var findQuestion = false;
        while (true) {
            loopCount++;
            solver.clearInfomations();
            result = solver.solveSudoku(Q, 1, true);
            if (result.result) {
                if (result.dup) {
                    putMemo = putRandomNumberToQ();
                    if (decidedNumberCount >= 28) {
                        numberOver++;
                        //console.log("num over : " + numberOver);
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
                //console.log("err : " + loopCount + " : " + decidedNumberCount);
                Q[putMemo.i][putMemo.j] = 0;
                putMemo = putRandomNumberToQ();
                decidedNumberCount--;
            }
        }

        var info = solver.getInfomations();
        if (findQuestion) {
            //console.log("find question " + info.callCount + " " + decidedNumberCount);
            var worstCallCount = info.callCount;
            var qTemp = Q;
            var ngList = [];
            while(true) {
                var sophisticatedQ = null;
                iterateRemovedQ(qTemp, function (rQ, str) {
                    if(ngList.indexOf(str) != -1) return;
                    result = solver.solveSudoku(rQ, 1, true);
                    if (result.dup) {
                        ngList.push(str);
                    } else {
                        var callCount = solver.getInfomations().callCount;
                        if (!sophisticatedQ) {
                            sophisticatedQ = rQ;
                            worstCallCount = callCount;
                            info = solver.getInfomations();
                        } else if (callCount > worstCallCount) {
                            worstCallCount = callCount;
                            sophisticatedQ = rQ;
                            info = solver.getInfomations();
                        }
                    }
                    solver.clearInfomations();
                });
                if (sophisticatedQ) {
                    decidedNumberCount--;
                    qTemp = sophisticatedQ;
                } else {
                    break;
                }
            }
            Q = qTemp;
            solver.clearInfomations();
            result = solver.solveSudoku(Q, 1, true);
            info = solver.getInfomations();
            //console.log("sophisticated? " + info.callCount + " " + decidedNumberCount);
            //console.log("loopCount  : " + loopCount);
            //console.log("numberOver : " + numberOver);
            //console.log("callCount1 : " + callCount1);
            //console.log("invalid    : " + invalid);
            if (info.callCount >= 20 && decidedNumberCount <= 23) { 
                break;
            }
        } else {
        }
    }
    //var info = solver.getInfomations();
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

var getCopyQuestion = function (Q, len) {
    var CQ = [];
    for (var i = 0; i < len; i++) {
        CQ.push([]);
        for (var j = 0; j < len; j++) {
            CQ[i].push(Q[i][j]);
        }
    }
    return CQ;
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
    try {
        fs.statSync("questions.json");
        var qText = fs.readFileSync("questions.json");
        var qJson = JSON.parse(qText);
        var qs = qJson.concat(questions);
        fs.writeFileSync("questions.json", JSON.stringify(qs));

        var iText = fs.readFileSync("questions_info.txt")
        iText += getMemoStringFromInfoList(infoList, false);
        fs.writeFileSync("questions_info.txt", iText);
    } catch {
        fs.writeFileSync("questions.json", JSON.stringify(questions));
        var str = getMemoStringFromInfoList(infoList, true);
        fs.writeFileSync("questions_info.txt", str);
    }
};

var getMemoStringFromInfoList = function (infoList, needHeader) {
    var str = "";
    if (needHeader) {
        str += "No\tHint\tCall\tMaxDepth\tLoop";
    }

    for (var idx in infoList) {
        str += "\n";
        info = infoList[idx];
        str += (parseInt(idx) + 1) + "\t";
        str += info.decidedNumberCount + "\t";
        str += info.callCount + "\t";
        str += info.maxDepth + "\t";
        str += info.loopCount;
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

if (cluster.isMaster) {
    if (process.argv[3]) {
        console.log("create Q by parallel " + parseInt(process.argv[3]));
        createQuestionParallel(parseInt(process.argv[2]), parseInt(process.argv[3]));
    } else {
        console.log("create Q by single");
        createQuestions(parseInt(process.argv[2]));
    }
}
