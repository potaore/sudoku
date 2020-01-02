var fs = require("fs");
var solver = require("./solve_sudoku.js");

var totalQcount = 1;
var testSolve = function (fileName, checkDupSol, printEach, validateCountMemo, doubleValidate, qNumber) {
    var text = fs.readFileSync(fileName);
    var questions = JSON.parse(text);

    console.time("total");
    var tempCount1 = 0;
    var tempCount2 = 0;
    var tempCount3 = 0;
    for (var key in questions) {
        if (qNumber && qNumber != parseInt(key) + 1) continue;
        solver.clearInfomations();
        if (printEach) console.time(parseInt(key) + 1);
        var result = solver.analizeSudoku(questions[key]);
        //var result = solver.solveSudoku(questions[key], 1, checkDupSol);
        if (!result.result) {
            console.log("no solution at q" + (parseInt(key) + 1));
            console.log(solver.getInfomations().callCount);
            //console.log(solver.getInfomations().tempObjs);
        } else if (result.secondResult) {
            console.log("dup solution at q" + (parseInt(key) + 1));
            console.log("first");
            console.log(getAnswerString(solver.memoMapToAnswer(result.memoMap)));
            console.log();
            console.log("second");
            console.log(getAnswerString(solver.memoMapToAnswer(result.secondResult.memoMap)));
            console.log();
        }
        if (printEach) console.timeEnd(parseInt(key) + 1);
        var info = solver.getInfomations();
        //console.log(totalQcount + "\t" + info.callCount + "\t" + info.maxDepth);
        totalQcount++;
        tempCount1 += solver.getInfomations().blockAndLineColumnPatternsRemoveCount;
        tempCount2 += solver.getInfomations().singleNumberPatternRemoveCount;
        tempCount3 += solver.getInfomations().chainRemoveCount;
        if (validateCountMemo) {
            var count = 0;
            for (var i = 1; i <= 9; i++) {
                for (var j = 1, num = 1; j <= 9; j++ , num = num << 1) {
                    count += result.countMemo.numsMemo.lines[i][num];
                    count += result.countMemo.numsMemo.columns[i][num];
                    count += result.countMemo.numsMemo.blocks[i][num];
                }
            }
            if (count !== 243) {
                console.log("invalid num count at q" + (parseInt(key) + 1));
                console.log(count);
            }
        }

        if (doubleValidate) {
            var result = solver.validateQuestion(solver.memoMapToAnswer(result.memoMap));
            if (!result) {
                console.log("invalid answer at q" + (parseInt(key) + 1));
            }
        }
    }
    console.timeEnd("total");
    console.log(tempCount1);
    console.log(tempCount2);
    console.log(tempCount3);
};

var showQuestion = function (fileName, qNum) {
    var text = fs.readFileSync(fileName);
    var questions = JSON.parse(text);
    var str = "";
    var question = questions[qNum - 1];
    for (var i in question) {
        var line = question[i];
        console.log(line.join(" "));
        str += line.join("\t");
        str += "\n";
        str = str.replace(/0/g, "");
    }
    fs.writeFileSync("temp_question.txt", str);
};


var getSampleQuestions = function () {
    var qs = [];
    var q1 = [
        [6, 5, 0, 0, 0, 0, 0, 0, 9],
        [0, 0, 2, 0, 8, 0, 0, 0, 0],
        [0, 0, 1, 9, 3, 2, 6, 0, 0],
        [0, 0, 0, 8, 0, 0, 2, 0, 0],
        [0, 0, 0, 4, 5, 0, 0, 0, 0],
        [0, 0, 9, 0, 0, 3, 0, 0, 7],
        [0, 9, 0, 0, 0, 0, 7, 0, 0],
        [4, 0, 0, 0, 0, 0, 3, 8, 0],
        [0, 0, 7, 0, 1, 0, 9, 0, 0]
    ];
    var q2 = [
        [0, 0, 2, 0, 5, 0, 0, 0, 8],
        [7, 0, 0, 0, 0, 0, 5, 0, 9],
        [0, 3, 0, 0, 0, 0, 0, 6, 0],
        [0, 0, 0, 7, 0, 6, 8, 0, 4],
        [2, 0, 8, 0, 0, 0, 0, 0, 0],
        [0, 9, 0, 0, 0, 0, 3, 0, 0],
        [9, 0, 0, 0, 1, 0, 0, 4, 0],
        [0, 0, 1, 2, 0, 0, 9, 0, 0],
        [0, 2, 4, 0, 0, 0, 0, 1, 0]
    ];
    var q3 = [
        [0, 1, 3, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 8, 0, 0, 6],
        [0, 7, 0, 0, 0, 0, 0, 0, 1],
        [0, 6, 0, 0, 0, 0, 4, 9, 0],
        [0, 0, 0, 0, 7, 0, 8, 0, 0],
        [0, 0, 7, 0, 6, 0, 2, 0, 0],
        [2, 0, 0, 0, 9, 6, 3, 0, 8],
        [0, 4, 0, 0, 2, 0, 6, 0, 0],
        [7, 0, 0, 4, 0, 0, 0, 0, 0]
    ];
    var q4 = [
        [0, 0, 5, 3, 0, 0, 0, 0, 0],
        [8, 0, 0, 0, 0, 0, 0, 2, 0],
        [0, 7, 0, 0, 1, 0, 5, 0, 0],
        [4, 0, 0, 0, 0, 5, 3, 0, 0],
        [0, 1, 0, 0, 7, 0, 0, 0, 6],
        [0, 0, 3, 2, 0, 0, 0, 8, 0],
        [0, 6, 0, 5, 0, 0, 0, 0, 9],
        [0, 0, 4, 0, 0, 0, 0, 3, 0],
        [0, 0, 0, 0, 0, 9, 7, 0, 0]
    ];
    var q5 = [
        [0, 6, 1, 0, 0, 7, 0, 0, 3],
        [0, 9, 2, 0, 0, 3, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 8, 5, 3, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 5, 0, 4],
        [5, 0, 0, 0, 0, 8, 0, 0, 0],
        [0, 4, 0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 1, 6, 0, 8, 0, 0],
        [6, 0, 0, 0, 0, 0, 0, 0, 0]
    ];
    var q6 = [
        [0, 8, 0, 0, 0, 0, 1, 5, 0],
        [4, 0, 6, 5, 0, 9, 0, 8, 0],
        [0, 0, 0, 0, 0, 8, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 2, 0, 4, 0, 0, 0, 3],
        [3, 0, 0, 8, 0, 1, 0, 0, 0],
        [9, 0, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 0, 0, 0, 0, 0, 4],
        [1, 5, 0, 0, 0, 0, 0, 9, 0]
    ];
    var q7 = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ];
    var q8 = [
        [0, 0, 0, 4, 0, 0, 0, 0, 0],
        [2, 8, 0, 0, 6, 9, 0, 0, 0],
        [5, 0, 0, 0, 0, 0, 0, 7, 3],
        [0, 9, 0, 0, 0, 1, 0, 8, 0],
        [0, 0, 8, 0, 4, 0, 0, 0, 6],
        [0, 0, 0, 0, 0, 0, 5, 0, 0],
        [1, 4, 0, 0, 8, 0, 0, 0, 0],
        [9, 0, 0, 0, 7, 0, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0, 0, 4]
    ];
    var q9 = [
        [8, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 3, 6, 0, 0, 0, 0, 0],
        [0, 7, 0, 0, 9, 0, 2, 0, 0],
        [0, 5, 0, 0, 0, 7, 0, 0, 0],
        [0, 0, 0, 0, 4, 5, 7, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 3, 0],
        [0, 0, 1, 0, 0, 0, 0, 6, 8],
        [0, 0, 8, 5, 0, 0, 0, 1, 0],
        [0, 9, 0, 0, 1, 0, 4, 0, 0]
    ];
    var qTemp = [
        [1, 2, 0, 3, 0, 0, 0, 0, 0],
        [3, 4, 0, 0, 0, 0, 1, 0, 0],
        [0, 0, 5, 0, 0, 0, 0, 0, 0],
        [6, 0, 2, 4, 0, 0, 5, 0, 0],
        [0, 0, 0, 0, 6, 0, 0, 7, 0],
        [0, 0, 0, 0, 0, 8, 0, 0, 6],
        [0, 0, 4, 2, 0, 0, 3, 0, 0],
        [0, 0, 0, 0, 7, 0, 0, 0, 9],
        [0, 0, 0, 0, 0, 9, 0, 8, 0]];
    //qs.push(q1);
    qs.push(q2);
    qs.push(q3);
    qs.push(q4);
    qs.push(q5);
    qs.push(q6);
    qs.push(q7);
    qs.push(q8);
    //qs.push(q9);
    qs.push(qTemp);
    return qs;
};

var test = function (loopCount, checkDupSol, silent) {
    var qs = getSampleQuestions();
    for (var i = 0; i < loopCount; i++) {
        for (var key in qs) {
            var q = qs[key];
            solver.clearInfomations();
            if (!silent) console.time();
            result = solver.analizeSudoku(q);
            //console.log(validateQuestion(q));
            if (!silent) console.timeEnd();
            if (result.secondResult) {
                if (!silent) console.log("invalid Q");
            }
            var infomations = solver.getInfomations();
            if (result.result) {
                if (loopCount == 1) {
                    if (!silent) console.log("question solved!" + JSON.stringify(infomations));
                    //console.log(JSON.stringify(result.countMemo.numbersMemo));
                }
            } else {
                if (!silent) console.log("question not solved..... " + JSON.stringify(infomations));
            }
        }
    }


    if (!silent) console.log(getAnswerString(solver.memoMapToAnswer(result.memoMap)));

    if (result.secondResult) {
        if (!silent) console.log("");
        if (!silent) console.log("but q has dup solutions...");
        if (!silent) console.log(getAnswerString(solver.memoMapToAnswer(result.secondResult.memoMap)));
    }
};



var getAnswerString = function (answer) {
    var str = "";
    for (var i = 0; i < 9; i++) {
        for (var j = 0; j < 9; j++) {
            str += answer[i][j];
        }
        str += "\n";
    }
    return str;
};