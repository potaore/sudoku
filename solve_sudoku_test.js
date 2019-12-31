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
        //console.log(totalQcount + "\t" + info.callCount + "\t" + info.firstRecursiveCall);
        totalQcount++;
        tempCount1 += solver.getInfomations().blockAndLineColumnPatternsRemoveCount;
        tempCount2 += solver.getInfomations().singleNumberPatternRemoveCount;
        tempCount3 += solver.getInfomations().chainRemoveCount;
        if (validateCountMemo) {
            var count = 0;
            for (var i = 1; i <= 9; i++) {
                for (var j = 1; j <= 9; j++) {
                    count += result.countMemo.numbersMemo.lines[i][j];
                    count += result.countMemo.numbersMemo.columns[i][j];
                    count += result.countMemo.numbersMemo.blocks[i][j];
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
    [1, 0, 0, 2, 0, 0, 8, 3, 0],
    [0, 0, 0, 0, 0, 0, 0, 9, 0],
    [0, 6, 0, 8, 0, 0, 5, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [3, 8, 4, 6, 0, 0, 0, 0, 0],
    [2, 0, 0, 5, 0, 0, 4, 0, 0],
    [0, 3, 0, 4, 0, 0, 0, 5, 0],
    [0, 0, 7, 0, 8, 0, 0, 0, 2],
    [4, 0, 0, 0, 0, 6, 0, 1, 9]];
    qs.push(q1);
    qs.push(q2);
    qs.push(q3);
    qs.push(q4);
    qs.push(q5);
    qs.push(q6);
    qs.push(q7);
    qs.push(q8);
    qs.push(q9);
    //qs.push(qTemp);
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


//test(1, true, false);
//test(10, true, false);

//validateQuestions("questions_1000.json");

//testSolve("questions_00001_01000.json", true, true, false, false, 1);

//showQuestion("questions_00001_01000.json", 1);

//showQuestion("questions_00001_01000.json", 3);
testSolve("questions_00001_01000.json", true, false, false, false);
testSolve("questions_01001_02000.json", true, false, false, false);
testSolve("questions_02001_03000.json", true, false, false, false);
testSolve("questions_03001_04000.json", true, false, false, false);
testSolve("questions_04001_05000.json", true, false, false, false);
testSolve("questions_05001_06000.json", true, false, false, false);
//testSolve("questions.json", true, true, false);
//showQuestion("questions_02001_03000.json", 419);
//testSolve("./others_questions/sudoku17.json", true, true, false);
//showQuestion("./others_questions/sudoku17.json", 49151);
//testSolve("./others_questions/HardestDatabase110626_int.json", true, true, false);
//testSolve("./others_questions/saikoukyuu.json", true, true, false);
//testSolve("./others_questions/program-genkai.json", true, true, false);

//showQuestion("HardestDatabase110626.json", 61);
//testSolve("questions_removed.json", true, false, false);

//test(1, true);
//console.log(getGroupValiation(["1_", "2_", "3_", "4_", "5_"], 1));
//testSolve("questions_removed.json", true, false, false);
//removeQuestions("questions.json", "questions_removed.json", [44, 60, 62, 76, 77, 88, 101, 113, 114, 115, 116, 119, 121, 164, 175, 183, 201, 2, 9, 21, 29, 50, 52, 53, 58, 59, 64, 66, 74, 84, 85, 92, 97, 102, 103, 108, 110, 135, 151, 167, 174, 187, 199, 4, 14, 19, 28, 30, 36, 37, 39, 41, 42, 61, 65, 70, 72, 75, 79, 82, 96, 99, 105, 107, 134, 137, 141, 148, 152, 155, 156, 162, 171, 172, 173, 176, 185, 186, 188, 192, 200, 203, 0, 7, 10, 11, 12, 13, 17, 24, 34, 38, 40, 43, 45, 46, 47, 48, 51, 54, 57, 68, 83, 89, 90, 93, 98, 100, 111, 112, 117, 120, 122, 125, 126, 128, 129, 131, 132, 145, 153, 157, 163, 165, 166, 168, 169, 170, 180, 181, 182, 184, 190, 191, 194, 195, 196, 198, 205, 209, 27, 177, 140, 193, 3, 160, 78, 197, 16, 23, 33, 49, 56, 118, 144, 150, 154]);
//concatQuestions("questions_03001_04000.json", "questions_removed.json", "questions_03001_04000_concat.json");
//console.log(process.memoryUsage());
//testSolve("questions.json", true, false, false);
//console.log(JSON.parse(fs.readFileSync("questions_03001_04000_concat.json")).length);