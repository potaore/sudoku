var exports = exports;
if (!exports) exports = {};
const q_util = exports;
{
    const QLEN = 81;
    const ZEROS = `.abcdefghijklmnopqrsyuvwxyzABCDEFGHIJKLMNOPQRSYUVWXYZ!?,=-+*_^~/|%&"'()[]{}:;#$@0`;

    q_util.deflate = text => {
        let deflated = "";
        let zero_count = 0;
        for (let i = 0; i < QLEN; i++) {
            if (text.charAt(i).match(/[1-9]/)) {
                if (zero_count) deflated += ZEROS.charAt(zero_count - 1);
                zero_count = 0;
                deflated += text.charAt(i);
            } else {
                zero_count++;
            }
        }
        if (zero_count) deflated += ZEROS.charAt(zero_count - 1);
        return deflated;
    };

    q_util.inflate = deflated => {
        let text = "";
        for (let i = 0; i < deflated.length; i++) {
            const ch = deflated.charAt(i);
            if (ch.match(/[1-9]/)) {
                text += ch;
            } else {
                text += ".".repeat(ZEROS.indexOf(ch) + 1);
            }
        }
        return text;
    };

    q_util.to_json = text => {
        const q = [];
        let index = 0;
        for (let i = 0; i < 9; i++) {
            let row = [];
            for (let j = 0; j < 9; j++) {
                let ch = text.charAt(index);
                if (ch.match(/[1-9]/)) {
                    row.push(parseInt(ch));
                } else {
                    row.push(0);
                }
                index++;
            }
            q.push(row);
        }
        return q;
    };
}

const fs = require("fs");


[
    "questions_00001_01000.txt",
    "questions_01001_02000.txt",
    "questions_02001_03000.txt",
    "questions_03001_04000.txt",
    "questions_04001_05000.txt",
    "questions_05001_06000.txt",
    "questions_06001_07000.txt",
    "questions_07001_08000.txt"]
    .forEach(f => {
        const qtexs = fs.readFileSync(f).toString().split(/\n/);
        const deflatedqs = qtexs.map(text => q_util.deflate(text));
        fs.writeFileSync(f.replace(/(.*)\.txt/, "def_$1.txt"), deflatedqs.join("\n"));
    });
    