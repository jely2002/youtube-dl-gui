const execa = require("execa");

class DetectPython {
    async test(command) {
        try {
            await execa(command, ['--version']);
            return true;
        } catch(e) {
            return false;
        }
    }

    async detect() {
        if(await this.test("python") === true) return "python";
        else if(await this.test("python3") === true) return "python3";
        else if(await this.test("python2") === true) return "python2";
        else return "python";
    }
}

module.exports = DetectPython;
