var cluster = require("cluster");
var fs = require("fs");
var solver = require("./solve_sudoku.js");

var createQuestion = function () {
    var Q = shuffleQuestion(getSampleAnswer());
    var indexList = getRomdomIndexList();
    //console.log(indexList);
    var hint = 81;
    while (indexList.length >= 70) {
        var ij = indexList.pop();
        Q[ij[0]][ij[1]] = 0;
        hint--;
    }
    while (indexList.length) {
        var ij = indexList.pop();
        var CQ = getCopyQuestion(Q);
        CQ[ij[0]][ij[1]] = 0;
        solver.clearInfomations();
        var aResult = solver.analizeSudoku(CQ);
        if (aResult.result) {
            if (!aResult.dup) {
                Q = CQ;
                hint--;
            }
        } else {
            console.log("why")
        }
    }
    solver.clearInfomations();
    solver.analizeSudoku(Q);
    var info = solver.getInfomations();
    info.hint = hint;
    return [Q, info];
};

var getSampleAnswer = function () {
    var seed = rnd8();
    switch (seed) {
        case 0: return [[2, 8, 3, 4, 6, 7, 1, 5, 9], [4, 7, 6, 5, 1, 9, 3, 8, 2], [5, 9, 1, 2, 3, 8, 6, 4, 7], [7, 4, 5, 6, 9, 3, 8, 2, 1], [8, 1, 2, 7, 4, 5, 9, 6, 3], [3, 6, 9, 8, 2, 1, 4, 7, 5], [9, 2, 4, 1, 7, 6, 5, 3, 8], [6, 3, 8, 9, 5, 2, 7, 1, 4], [1, 5, 7, 3, 8, 4, 2, 9, 6]];
        case 1: return [[8, 1, 2, 7, 5, 3, 6, 4, 9], [9, 4, 3, 6, 8, 2, 1, 7, 5], [6, 7, 5, 4, 9, 1, 2, 8, 3], [1, 5, 4, 2, 3, 7, 8, 9, 6], [3, 6, 9, 8, 4, 5, 7, 2, 1], [2, 8, 7, 1, 6, 9, 5, 3, 4], [5, 2, 1, 9, 7, 4, 3, 6, 8], [4, 3, 8, 5, 2, 6, 9, 1, 7], [7, 9, 6, 3, 1, 8, 4, 5, 2]];
        case 2: return [[1, 5, 6, 3, 9, 4, 7, 2, 8], [8, 7, 4, 2, 6, 5, 9, 3, 1], [2, 9, 3, 8, 1, 7, 5, 4, 6], [4, 3, 9, 1, 2, 8, 6, 5, 7], [5, 8, 7, 9, 4, 6, 3, 1, 2], [6, 2, 1, 7, 5, 3, 4, 8, 9], [3, 4, 2, 6, 7, 1, 8, 9, 5], [9, 6, 8, 5, 3, 2, 1, 7, 4], [7, 1, 5, 4, 8, 9, 2, 6, 3]];
        case 3: return [[6, 2, 1, 9, 4, 3, 7, 5, 8], [7, 8, 3, 6, 1, 5, 4, 9, 2], [5, 9, 4, 7, 2, 8, 3, 6, 1], [1, 4, 2, 8, 7, 9, 6, 3, 5], [3, 5, 7, 4, 6, 1, 2, 8, 9], [8, 6, 9, 5, 3, 2, 1, 7, 4], [2, 3, 8, 1, 9, 7, 5, 4, 6], [9, 1, 6, 3, 5, 4, 8, 2, 7], [4, 7, 5, 2, 8, 6, 9, 1, 3]];
        case 4: return [[6, 8, 4, 7, 9, 2, 5, 3, 1], [3, 2, 1, 5, 8, 4, 9, 7, 6], [7, 9, 5, 3, 6, 1, 8, 4, 2], [2, 7, 8, 6, 5, 9, 4, 1, 3], [9, 1, 3, 2, 4, 8, 7, 6, 5], [4, 5, 6, 1, 3, 7, 2, 8, 9], [1, 4, 7, 9, 2, 3, 6, 5, 8], [8, 6, 9, 4, 1, 5, 3, 2, 7], [5, 3, 2, 8, 7, 6, 1, 9, 4]];
        case 5: return [[9, 8, 7, 6, 5, 4, 3, 2, 1], [6, 5, 4, 3, 2, 1, 9, 8, 7], [3, 2, 1, 9, 8, 7, 6, 5, 4], [8, 7, 9, 4, 3, 6, 2, 1, 5], [2, 3, 5, 1, 9, 8, 7, 4, 6], [4, 1, 6, 5, 7, 2, 8, 9, 3], [7, 9, 3, 8, 4, 5, 1, 6, 2], [5, 6, 8, 2, 1, 3, 4, 7, 9], [1, 4, 2, 7, 6, 9, 5, 3, 8]];
        case 6: return [[5, 6, 3, 8, 7, 4, 2, 1, 9], [8, 7, 1, 9, 5, 2, 6, 4, 3], [4, 9, 2, 6, 1, 3, 8, 7, 5], [7, 5, 6, 4, 9, 8, 3, 2, 1], [3, 2, 8, 1, 6, 5, 7, 9, 4], [1, 4, 9, 3, 2, 7, 5, 8, 6], [6, 3, 7, 2, 4, 9, 1, 5, 8], [2, 8, 4, 5, 3, 1, 9, 6, 7], [9, 1, 5, 7, 8, 6, 4, 3, 2]];
        case 7: return [[1, 5, 6, 3, 9, 4, 7, 2, 8], [8, 7, 4, 2, 6, 5, 9, 3, 1], [2, 9, 3, 8, 1, 7, 5, 4, 6], [4, 3, 9, 1, 5, 8, 6, 7, 2], [5, 1, 7, 9, 2, 6, 3, 8, 4], [6, 2, 8, 7, 4, 3, 1, 5, 9], [3, 4, 2, 6, 7, 1, 8, 9, 5], [9, 8, 1, 5, 3, 2, 4, 6, 7], [7, 6, 5, 4, 8, 9, 2, 1, 3]];
        default : return [[2, 8, 3, 4, 6, 7, 1, 5, 9], [4, 7, 6, 5, 1, 9, 3, 8, 2], [5, 9, 1, 2, 3, 8, 6, 4, 7], [7, 4, 5, 6, 9, 3, 8, 2, 1], [8, 1, 2, 7, 4, 5, 9, 6, 3], [3, 6, 9, 8, 2, 1, 4, 7, 5], [9, 2, 4, 1, 7, 6, 5, 3, 8], [6, 3, 8, 9, 5, 2, 7, 1, 4], [1, 5, 7, 3, 8, 4, 2, 9, 6]]; 
    }
};

var shuffleQuestion = function (q) {
    q = shuffleLC(q);
    q = flipQ(q);
    q = rotateQ(q);
    q = shuffleNum(q);
    return q;
};

var shuffleLC = function (q) {
    for (var i = 0; i < 15 + rnd3(); i++) {
        q = shuffleLine(q);
        q = shuffleColumn(q);
    }
    return q;
}

var shuffleLine = function (q) {
    var [tl1, tl2] = getTarget();
    var newQ = [];
    var tempLine;
    for (var i = 0; i < 9; i++) {
        if (i == tl1) {
            tempLine = q[i].concat();
        } else if (i == tl2) {
            newQ.push(q[i].concat());
            newQ.push(tempLine);
        } else {
            newQ.push(q[i].concat());
        }
    }
    return newQ;
};

var shuffleColumn = function (q) {
    var [tc1, tc2] = getTarget();
    var newQ = [];
    for (var i = 0; i < 9; i++) {
        var line = [];
        var temp;
        for (var j = 0; j < 9; j++) {
            if (j == tc1) {
                temp = q[i][j];
            } else if (j == tc2) {
                line.push(q[i][j]);
                line.push(temp);
            } else {
                line.push(q[i][j]);
            }
        }
        newQ.push(line);
    }
    return newQ;
};

var getTarget = function () {
    var targetBlock = rnd3();
    var target1 = rnd3();
    var target2 = rnd3();
    while (target1 == target2) target2 = rnd3();
    target1 += targetBlock * 3;
    target2 += targetBlock * 3;
    if (target1 > target2) {
        [target1, target2] = [target2, target1];
    }
    return [target1, target2];
};

var flipQ = function (q) {
    if (rnd3()) return q;
    var newQ = [];
    for (var i = 0; i < 9; i++) {
        var line = [];
        for (var j = 0; j < 9; j++) {
            line.push(q[8 - j][8 - i]);
        }
        newQ.push(line);
    }
    if (rnd2()) return q;
    var newQ = [];
    for (var i = 0; i < 9; i++) {
        var line = [];
        for (var j = 0; j < 9; j++) {
            line.push(q[j][i]);
        }
        newQ.push(line);
    }
    return newQ;
};

var rotateQ = function (q) {
    var newQ = q;
    while (rnd3()) {
        newQ = [];
        for (var i = 0; i < 9; i++) {
            var line = [];
            for (var j = 0; j < 9; j++) {
                line.push(q[((5 - j) % 9) + 3][i]);
            }
            newQ.push(line);
        }
    }
    return newQ;
};

var shuffleNum = function (q) {
    for (var l = 0; l < 5; l++) {
        var n1 = rnd(9) + 1;
        var n2 = rnd(9) + 1;
        while (n2 == n1) n2 = rnd(9) + 1;
        for (var i = 0; i < 9; i++) {
            for (var j = 0; j < 9; j++) {
                if (q[i][j] == n1) q[i][j] = n2;
                else if (q[i][j] == n2) q[i][j] = n1;
            }
        }
    }
    return q;
};

var getRomdomIndexList = function () {
    var list = [];
    for (var i = 0; i < 9; i++) {
        for (var j = 0; j < 9; j++) {
            list.push([i, j]);
        }
    }
    list.sort(() => 0.5 - Math.random());
    list.sort(() => 0.5 - Math.random());
    return list;
};

var rnd2 = () => Math.floor(Math.random() * 2);
var rnd3 = () => Math.floor(Math.random() * 3);
var rnd8 = () => Math.floor(Math.random() * 8);
var rnd = (num) => Math.floor(Math.random() * num);

var getCopyQuestion = function (Q) {
    var CQ = [];
    for (var i = 0; i < 9; i++) {
        CQ.push([]);
        for (var j = 0; j < 9; j++) {
            CQ[i].push(Q[i][j]);
        }
    }
    return CQ;
};



var createQuestions = function (num, parallel, id) {
    var questions = [];
    var infoList = [];
    if (!id) id = "single";
    for (var i = 0; i < num; i++) {
        var res = createQuestion();
        var info = res[1];
        //console.log(id + "::" + info.hint + " " + info.callCount);
        if (info.callCount >= 10 && info.hint < 28) {
            questions.push(res[0]);
            infoList.push(res[1]);
            console.log(id + "::" + (i + 1) + " / " + num + "  " + info.callCount);
        } else {
            i--;
        }
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
        str += "No\tHint\tCall\tMaxDepth";
    }

    for (var idx in infoList) {
        str += "\n";
        info = infoList[idx];
        str += (parseInt(idx) + 1) + "\t";
        str += info.hint + "\t";
        str += info.callCount + "\t";
        str += info.maxDepth;
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

/*
while (true) {
    var [q, info] = createQuestion();
    console.log(info.callCount, info.hint);
    if (info.callCount > 20) {
        console.log(JSON.stringify(q));
        console.log(JSON.stringify(info));
        break;
    }
}
*/

//createQuestions(7);

