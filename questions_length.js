var fs = require("fs");

if(process.argv.length == 3) {
    console.log(JSON.parse(fs.readFileSync(process.argv[2])).length);
} else {
    console.log("set args file");
}