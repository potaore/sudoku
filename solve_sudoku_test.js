var fs = require("fs");
var solver = require("./solve_sudoku.js");



var testSolve = function (fileName, checkDupSol, printEach, validateCountMemo) {
    var text = fs.readFileSync(fileName);
    var questions = JSON.parse(text);
    var infoList = [];

    console.time("total");
    for (var key in questions) {
        solver.clearInformations();
        if (printEach) console.time(parseInt(key) + 1);
        var result = solver.solveSudoku(questions[key], 1, checkDupSol);
        if (!result.result || result.secondResult) console.log("err at q" + (parseInt(key) + 1));
        if (printEach) console.timeEnd(parseInt(key) + 1);

        //console.log(solver.getInformations().findSingleNumberRemoveCount);
        if (validateCountMemo) {
            var count = 0;
            for (var i = 1; i <= 9; i++) {
                for (var j = 1; j <= 9; j++) {
                    count += result.countMemo.numbersMemo.lines[i][j];
                    count += result.countMemo.numbersMemo.columns[i][j];
                    count += result.countMemo.numbersMemo.blocks[i][j];
                }
            }
            if (count !== 0) {
                console.log("invalid num count at q" + (parseInt(key) + 1));
                console.log(count);
            }
        }


        infoList.push(solver.getInformations());
    }
    console.timeEnd("total");
};


var validateQuestions = function (fileName) {
    var text = fs.readFileSync(fileName);
    var questions = JSON.parse(text);
    for (var key in questions) {
        if (!solver.validateQuestion(questions[key])) {
            console.log((parseInt(key) + 1) + " : invalid");
        }
    }
};

var showQuestion = function (fileName, idx) {
    var text = fs.readFileSync(fileName);
    var questions = JSON.parse(text);
    var str = "";
    var question = questions[idx];
    for (var i in question) {
        var line = question[i];
        console.log(line.join(" "));
        str += line.join("\t");
        str += "\n";
        str = str.replace(/0/g, "");
    }
    fs.writeFileSync("temp_question.txt", str);
};




var test = function (loopCount, checkDupSol) {
    var qs = [];

    var q1 = [[6, 5, "", "", "", "", "", "", 9], ["", "", 2, "", 8, "", "", "", ""], ["", "", 1, 9, 3, 2, 6, "", ""], ["", "", "", 8, "", "", 2, "", ""], ["", "", "", 4, 5, "", "", "", ""], ["", "", 9, "", "", 3, "", "", 7], ["", 9, "", "", "", "", 7, "", ""], [4, "", "", "", "", "", 3, 8, ""], ["", "", 7, "", 1, "", 9, "", ""]];
    var q2 = [["", "", 2, "", 5, "", "", "", 8], [7, "", "", "", "", "", 5, "", 9], ["", 3, "", "", "", "", "", 6, ""], ["", "", "", 7, "", 6, 8, "", 4], [2, "", 8, "", "", "", "", "", ""], ["", 9, "", "", "", "", 3, "", ""], [9, "", "", "", 1, "", "", 4, ""], ["", "", 1, 2, "", "", 9, "", ""], ["", 2, 4, "", "", "", "", 1, ""]];
    var q3 = [["", 1, 3, "", "", "", "", "", ""], ["", "", "", "", "", 8, "", "", 6], ["", 7, "", "", "", "", "", "", 1], ["", 6, "", "", "", "", 4, 9, ""], ["", "", "", "", 7, "", 8, "", ""], ["", "", 7, "", 6, "", 2, "", ""], [2, "", "", "", 9, 6, 3, "", 8], ["", 4, "", "", 2, "", 6, "", ""], [7, "", "", 4, "", "", "", "", ""]];
    var q4 = [["", "", 5, 3, "", "", "", "", ""], [8, "", "", "", "", "", "", 2, ""], ["", 7, "", "", 1, "", 5, "", ""], [4, "", "", "", "", 5, 3, "", ""], ["", 1, "", "", 7, "", "", "", 6], ["", "", 3, 2, "", "", "", 8, ""], ["", 6, "", 5, "", "", "", "", 9], ["", "", 4, "", "", "", "", 3, ""], ["", "", "", "", "", 9, 7, "", ""]];
    var q5 = [["", 6, 1, "", "", 7, "", "", 3], ["", 9, 2, "", "", 3, "", "", ""], ["", "", "", "", "", "", "", "", ""], ["", "", 8, 5, 3, "", "", "", ""], ["", "", "", "", "", "", 5, "", 4], [5, "", "", "", "", 8, "", "", ""], ["", 4, "", "", "", "", "", "", 1], ["", "", "", 1, 6, "", 8, "", ""], [6, "", "", "", "", "", "", "", ""]];
    var q6 = [["", 8, "", "", "", "", 1, 5, ""], [4, "", 6, 5, "", 9, "", 8, ""], ["", "", "", "", "", 8, "", "", ""], ["", "", "", "", "", "", "", "", ""], ["", "", 2, "", 4, "", "", "", 3], [3, "", "", 8, "", 1, "", "", ""], [9, "", "", "", 7, "", "", "", ""], [6, "", "", "", "", "", "", "", 4], [1, 5, "", "", "", "", "", 9, ""]];
    var q7 = [["", "", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", "", ""]];
    var q8 = [["", "", "", 4, "", "", "", "", ""], [2, 8, "", "", 6, 9, "", "", ""], [5, "", "", "", "", "", "", 7, 3], ["", 9, "", "", "", 1, "", 8, ""], ["", "", 8, "", 4, "", "", "", 6], ["", "", "", "", "", "", 5, "", ""], [1, 4, "", "", 8, "", "", "", ""], [9, "", "", "", 7, "", "", "", ""], ["", "", "", 2, "", "", "", "", 4]];
    var q9 = [[8, "", "", "", "", "", "", "", ""], ["", "", 3, 6, "", "", "", "", ""], ["", 7, "", "", 9, "", 2, "", ""], ["", 5, "", "", "", 7, "", "", ""], ["", "", "", "", 4, 5, 7, "", ""], ["", "", "", 1, "", "", "", 3, ""], ["", "", 1, "", "", "", "", 6, 8], ["", "", 8, 5, "", "", "", 1, ""], ["", 9, "", "", 1, "", 4, "", ""]];
    //qs.push(q1);
    //qs.push(q2);
    //qs.push(q3);
    qs.push(q4);
    qs.push(q5);
    qs.push(q6);
    qs.push(q7);
    qs.push(q8);
    qs.push(q9);

    for (var i = 0; i < loopCount; i++) {
        for (var key in qs) {
            var q = qs[key];
            solver.clearInformations();
            tempCount = 0;
            console.time();
            result = solver.solveSudoku(q, 1, checkDupSol);
            //console.log(validateQuestion(q));
            console.timeEnd();
            if (result.secondResult) {
                console.log("invalid Q");
            }
            var infomations = solver.getInformations();
            if (result.result) {
                if (loopCount == 1) {
                    console.log("question solved!" + JSON.stringify(infomations));
                    console.log(JSON.stringify(result.countMemo.numbersMemo));
                }
            } else {
                console.log("question not solved..... " + JSON.stringify(infomations));
            }
        }
    }


    for (var i = 1; i <= 9; i++) {
        var str = "";
        for (var j = 1; j <= 9; j++) {
            var memo = result.memoMap[i + "-" + j];
            str += Object.keys(memo).join('');
        }
        console.log(str);
    }

    if (result.secondResult) {
        console.log("");
        console.log("but q has dup solutions...");
        var str = "";
        for (var i = 1; i <= 9; i++) {
            var str = "";
            for (var j = 1; j <= 9; j++) {
                var memo = result.secondResult.memoMap[i + "-" + j];
                str += Object.keys(memo).join('');
            }
            console.log(str);
        }
    }
};






//test(3, true);

//validateQuestions("questions_1000.json");
//testSolve("questions_1000.json", true, false, false);
//testSolve("questions_1000_2.json", true, false, false);


//showQuestion("questions_1000_2.json", 32);

test(3, true);
//console.log(getGroupValiation(["1_", "2_", "3_", "4_", "5_"], 1));


console.log(process.memoryUsage());
