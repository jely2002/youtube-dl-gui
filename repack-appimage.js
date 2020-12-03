const escapeStringRegexp = require("escape-string-regexp");
const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");
const universalify = require('universalify')
const execa = universalify.fromPromise(require('execa'))
const GitHub = require('github-api')
const yaml = require('yaml')

const extractedImageFolderName = "squashfs-root";

exports.default = async function(context) {
    if(context.platformToTargets.values().next().value.values().next().value.name === "appImage") {
        await postProcess(context.outDir, path.basename(context.artifactPaths[0]))
    }
}

async function postProcess(packageFile, binary_name) {
    console.log("Unpacking intial AppImage")
    const packageDir = await unpack(path.join(packageFile, binary_name));
    console.log("Patching AppImage")
    disableSandbox(packageDir);
    ensureFileHasNoSuidBit(path.join(packageFile, binary_name));
    console.log("Packaging new AppImage")
    await packAndCleanup(packageDir, packageFile, binary_name);
    console.log("Publishing artifacts to GitHub")
    await publish(packageFile, binary_name)
}

function disableSandbox(packageDir) {
    const shFile = path.join(packageDir, "./AppRun");
    const shContentOriginal = fs.readFileSync(shFile).toString();
    const {content: shContentPatched, count: shContentPatchedCount} = (() => {
        const searchValue = `exec "$BIN"`;
        const replaceWith = `${searchValue} '--no-sandbox'`;
        let count = 0;
        const content = shContentOriginal.replace(
            new RegExp(escapeStringRegexp(searchValue), "g"),
            () => (count++, replaceWith),
        );
        return {count, content};
    })();

    if (shContentPatched === shContentOriginal || shContentPatchedCount !== 2) {
        throw new Error(`Failed to patch content of the "${shFile}" file`);
    }

    fs.writeFileSync(shFile, shContentPatched);
}

async function unpack(packageFile){
    const cwd = path.dirname(packageFile);
    const packageDir = path.join(
        path.dirname(packageFile),
        extractedImageFolderName,
    );

    await execShell("npx", ["rimraf", packageDir], false);
    await execShell(packageFile, ["--appimage-extract"], {"cwd": cwd}, false);

    return packageDir;
}

async function packAndCleanup(packageDir, packageFile, binary_name) {
    const appImageFile = path.join(
        path.join(path.dirname(packageFile), "./appimagetool"),
        "./appimagetool-x86_64.AppImage",
    );
    const appImageTool = await resolveAppImageTool(packageFile, appImageFile);

    await execShell("rm", ["--force", appImageFile], false);
    await execShell(appImageTool, ["-n", "--comp", "xz", packageDir, path.join(packageFile, binary_name)], false);
    await execShell("npx", ["rimraf", packageDir], false);
    await execShell("npx", ["rimraf", path.join(packageFile, "/appimagetool")], false);
}

async function resolveAppImageTool(packageFile, appImageFile) {

    const cwd = path.dirname(appImageFile);

    mkdirp.sync(cwd);

    await execShell(
        "curl",
        [
            "--fail",
            "--location",
            "--output", appImageFile,
            `https://github.com/AppImage/AppImageKit/releases/download/continuous/${path.basename(appImageFile)}`,
        ], false
    );

    await execShell("chmod", ["+x", appImageFile], false);
    await execShell(appImageFile, ["--appimage-extract"], {"cwd": cwd}, false);

    return path.join(
        path.dirname(appImageFile),
        path.join(extractedImageFolderName, "AppRun"),
    )
}

function ensureFileHasNoSuidBit(file) {
    const stat = fs.statSync(file);

    if (!stat.isFile()) {
        throw new Error(`"${file}" is not a file`);
    }

    const hasSuidBit = Boolean(
        stat.mode
        &
        0x800,
    );

    if (hasSuidBit) {
        throw new Error(`"${file}" should not have SUID bit set`);
    }
}

async function execShell(command, args, options, getOutput) {
    const {stdout} = await execa(command, args, options)
    if(getOutput) {
        return stdout
    }
}

async function publish(distDir, appImage) {
    let githubToken
    try {
        githubToken = fs.readFileSync(path.join(distDir, '..', 'gh_token.txt'))
    } catch (err) {
        console.log("No GitHub token specified, skipping publish.")
        return
    }
    if(githubToken === "") {
        console.log("No GitHub token specified, skipping publish.")
        return
    }
    let gh = new GitHub({
        username: 'jely2002',
        token: githubToken
    })
    const pkg = require(path.join(distDir, '..', 'package.json'))
    const repo = await gh.getRepo('jely2002', 'youtube-dl-gui')
    const releases = await repo.listReleases()
    const result = await repo.createRelease({
        "tag_name": 'v' + pkg.version,
        "target_commitish": "master",
        "name": pkg.version,
        "body": "Draft release",
        "draft": true,
        "prerelease": false
    })
    const upload_url = result.data.upload_url.replace('{?name,label}', '')

    let ymlData = yaml.parse(fs.readFileSync(path.join(distDir, 'latest-linux.yml')).toString())
    ymlData.sha512 = await sha512sum(path.join(distDir, 'latest-linux.yml'));
    ymlData = yaml.stringify(ymlData)
    fs.writeFileSync(path.join(distDir, 'latest-linux.yml'), ymlData)

    const args_linux = [
        "--request POST",
        "--data-binary @" + path.join(distDir, 'latest-linux.yml'),
        '-H "Authorization: token ' + githubToken + '"',
        '-H "Content-Type: application/octet-stream"',
        upload_url + "?name=latest-linux.yml"
    ]
    const args_appimage = [
        "--request POST",
        "--data-binary @" + path.join(distDir, appImage),
        '-H "Authorization: token ' + githubToken + '"',
        '-H "Content-Type: application/octet-stream"',
        upload_url + "?name=" + appImage
    ]
    await execShell('curl', args_linux, {}, false)
    await execShell('curl', args_appimage, {}, false)
}

async function sha512sum(filename) {
    let output = execShell('sha512sum', [filename, "| cut -f1 | xxd -r -p | base64"], true)
    return output.toString().split('\n').join('').trim()
}
