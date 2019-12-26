var fs = require("fs");

var parseIntQuestions = function (file1, file2) {
    var questions = JSON.parse(fs.readFileSync(file1));
    var newQuestions = [];
    for (var qi = 0; qi < questions.length; qi++) {
        var q = questions[qi];
        var nq = [];
        for (var i = 0; i < 9; i++) {
            var line = [];
            for (var j = 0; j < 9; j++) {
                line.push(parseInt(q[i][j]));
            }
            nq.push(line);
        }
        newQuestions.push(nq);
    }
    fs.writeFileSync(file2, JSON.stringify(newQuestions));
};


if (process.argv.length == 4) {
    parseIntQuestions(process.argv[2], process.argv[3]);
} else {
    console.log("set args file1 file2");
}