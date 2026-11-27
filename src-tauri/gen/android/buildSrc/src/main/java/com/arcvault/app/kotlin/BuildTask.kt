import java.io.File
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import javax.inject.Inject
import org.gradle.process.ExecOperations

abstract class BuildTask : DefaultTask() {
    @get:Inject
    abstract val execOperations: ExecOperations

    @Input
    var rootDirRel: String? = null
    @Input
    var projectDir: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        runTauriCli()
    }

    fun runTauriCli() {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")

        val userHome = System.getProperty("user.home") ?: ""
        val extraPaths = listOf(
            "D:\\Program Files\\nodejs",
            "C:\\Program Files\\nodejs",
            "C:\\Program Files (x86)\\nodejs",
            "$userHome\\.cargo\\bin",
            "$userHome\\AppData\\Roaming\\npm"
        ).filter { File(it).exists() }

        val isWindows = Os.isFamily(Os.FAMILY_WINDOWS)
        val sysPath = System.getenv("PATH") ?: System.getenv("Path") ?: ""
        val newPath = (extraPaths + listOf(sysPath)).joinToString(File.pathSeparator)

        execOperations.exec {
            workingDir(File(projectDir, rootDirRel))
            if (isWindows) {
                executable("cmd.exe")
                args("/c", "npm", "run", "--", "tauri", "android", "android-studio-script")
            } else {
                executable("npm")
                args("run", "--", "tauri", "android", "android-studio-script")
            }

            environment("PATH", newPath)
            environment("Path", newPath)

            if (logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            if (release) {
                args("--release")
            }
            args(listOf("--target", target))
        }.assertNormalExitValue()
    }
}
