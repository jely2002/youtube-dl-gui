const execa = require ( 'execa' ),
    fs = require ( 'fs' ),
    path = require ( 'path' );

function isLinux ( targets ) {
    const re = /AppImage|snap|deb|rpm|freebsd|pacman/i;
    return !!targets.find ( target => re.test ( target.name ) );
}

async function afterPack ({ targets, appOutDir }) {
    if ( !isLinux ( targets ) ) return;
    const scriptPath = path.join(appOutDir, 'youtube-dl-gui'),
        script = '#!/bin/bash\n"${BASH_SOURCE%/*}"/youtube-dl-gui.bin "$@" --no-sandbox';
    await execa('mv', ['youtube-dl-gui', 'youtube-dl-gui.bin'], {"cwd": appOutDir});
    fs.writeFileSync (scriptPath, script);
    await execa ('chmod', ['+x', 'youtube-dl-gui'], {"cwd": appOutDir});

}

module.exports = afterPack;
