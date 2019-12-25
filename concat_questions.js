var fs = require("fs");
var concatQuestions = function (file1, file2, newFile) {
    var qs1 = JSON.parse(fs.readFileSync(file1));
    var qs2 = JSON.parse(fs.readFileSync(file2));
    fs.writeFileSync(newFile, JSON.stringify(qs1.concat(qs2)));
};

if(process.argv.length == 5) {
    concatQuestions(process.argv[2], process.argv[3], process.argv[4]);
} else {
    console.log("set args file1 file2 file3");
}