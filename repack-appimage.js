const escapeStringRegexp = require("escape-string-regexp");
const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");
const universalify = require('universalify')
const execa = universalify.fromPromise(require('execa'))

const extractedImageFolderName = "squashfs-root";

exports.default = async function(context) {
    if(context.platformToTargets.values().next().value.values().next().value.name == "appImage") {
        await postProcess(context.outDir, path.basename(context.artifactPaths[0]))
    } else {
        console.log("Non appImage build, repack not needed.")
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
    console.log("Repackaging completed")
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

    await execShell("npx", ["rimraf", packageDir]);
    await execShell(packageFile, ["--appimage-extract"], {"cwd": cwd});

    return packageDir;
}

async function packAndCleanup(packageDir, packageFile, binary_name) {
    const appImageFile = path.join(
        path.join(path.dirname(packageFile), "./appimagetool"),
        "./appimagetool-x86_64.AppImage",
    );
    const appImageTool = await resolveAppImageTool(packageFile, appImageFile);

    await execShell("rm", ["--force", appImageFile]);
    await execShell(appImageTool, ["-n", "--comp", "xz", packageDir, path.join(packageFile, binary_name)]);
    await execShell("npx", ["rimraf", packageDir]);
    await execShell("npx", ["rimraf", path.join(packageFile, "/appimagetool")]);
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
        ],
    );

    await execShell("chmod", ["+x", appImageFile]);
    await execShell(appImageFile, ["--appimage-extract"], {"cwd": cwd});

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

async function execShell(command, args, options) {
    const exec = await execa(command, args, options)
}
