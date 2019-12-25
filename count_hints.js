var fs = require("fs");

var countHints = function (fileName) {
    var questions = JSON.parse(fs.readFileSync(fileName));
    for (var i = 0; i < questions.length; i++) {
        var q = questions[i];
        var hintCount = 0;
        q.forEach(line => {
            line.forEach(cell => {
                if (cell && cell != "0") hintCount++;
            });
        });
        console.log((i + 1) + "\t" + hintCount)
    }
};


if(process.argv.length == 3) {
    countHints(process.argv[2]);
} else {
    console.log("set args file");
}