var fs = require("fs");

var removeQuestions = function (filenamme, removedQFile, pickedQFile, qNumbers) {
    var qs = JSON.parse(fs.readFileSync(filenamme));
    var removedQs = [];
    var pickedQs = [];
    for (var i = 0; i < qs.length; i++) {
        if (qNumbers.indexOf(i + 1) == -1) {
            removedQs.push(qs[i]);
        } else {
            pickedQs.push(qs[i]);
        }
    }
    fs.writeFileSync(removedQFile, JSON.stringify(removedQs));
    fs.writeFileSync(pickedQFile, JSON.stringify(pickedQs));
};

if(process.argv.length >= 6) {
    var qNumbers = [];
    for(var i = 5; i < process.argv.length; i++){
        qNumbers.push(parseInt(process.argv[i]));
    }
    console.log(qNumbers);
    removeQuestions(process.argv[2], process.argv[3], process.argv[4], qNumbers);
} else {
    console.log("set args file1 removedQFile pickedQFile ...qNumbers");
}