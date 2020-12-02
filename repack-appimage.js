const escapeStringRegexp = require("escape-string-regexp");
const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");
const universalify = require('universalify')
const execa = universalify.fromPromise(require('execa'))


// TODO pass destination directory instead of hardcoding it ("--appimage-extract" doesn't support destination parameter at the moment)
const extractedImageFolderName = "squashfs-root";

exports.default = async function(context) {
    console.log(context.outDir)
    console.log(context.packager[0].executableName)
    await postProcess(context.outDir, context.packager[0].executableName)
}

async function postProcess(packageFile, binary_name) {
    const packageDir = await unpack({packageFile});
    disableSandbox(packageDir);
    ensureFileHasNoSuidBit(path.join(packageDir, binary_name));
    await packAndCleanup(packageDir, packageFile);
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

async function packAndCleanup(packageDir, packageFile) {
    const appImageTool = await resolveAppImageTool({packageFile});

    await execShell("rm", ["--force", packageFile]);
    await execShell(appImageTool, ["-n", "--comp", "xz", packageDir, packageFile]);
    await execShell("npx", ["rimraf", packageDir]);
}

async function resolveAppImageTool(packageFile) {
    const appImageFile = path.join(
        path.join(path.dirname(packageFile), "./appimagetool"),
        "./appimagetool-x86_64.AppImage",
    );
    const cwd = path.dirname(appImageFile);

    mkdirp.sync(cwd);

    // TODO cache the "appimagetool"
    await execShell([
        "curl",
        [
            "--fail",
            "--location",
            "--output", appImageFile,
            `https://github.com/AppImage/AppImageKit/releases/download/continuous/${path.basename(appImageFile)}`,
        ],
    ]);

    await execShell("chmod", ["+x", appImageFile]);

    // unpacking the image in order to prevent the following error: AppImages require FUSE to run
    // https://docs.appimage.org/user-guide/run-appimages.html?highlight=fuse#the-appimage-tells-me-it-needs-fuse-to-run
    await execShell(appImageFile, ["--appimage-extract"], {"cwd": cwd});

    return {
        appImageTool: path.join(
            path.dirname(appImageFile),
            path.join(extractedImageFolderName, "AppRun"),
        ),
    };
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
    const executable = execa(command, args, options)
    executable.stdout.on('data', (data) => {
      console.log(data)
    })
}
