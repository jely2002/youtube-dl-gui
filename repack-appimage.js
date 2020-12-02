exports.default = async function(context) {
    console.log(context.outDir)
    console.log(context.appOutDir)
    console.log(context.packager)
    console.log(context.electronPlatformName)
    console.log(context.arch)
    console.log(context.targets)
}
