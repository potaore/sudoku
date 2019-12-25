var fs = require("fs");

var jsonToText = function (jsonFilename, textFilename) {
    var questions = JSON.parse(fs.readFileSync(jsonFilename));
    var str = "";
    for (var i = 0; i < questions.length; i++) {
        var q = questions[i];
        var qStr = "";
        q.forEach(line => {
            line.forEach(cell => {
                if (!cell || cell == "0" || cell == ".") {
                    qStr += ".";
                } else {
                    qStr += cell;
                }
            });
        });
        str += qStr + "\n";
    }
    fs.writeFileSync(textFilename, str);
};


if (process.argv.length == 4) {
    jsonToText(process.argv[2], process.argv[3]);
} else {
    console.log("set args file1 file2");
}