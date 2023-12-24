// import boxen from "boxen"
import { execSync, fork } from "child_process"
import { watch } from "chokidar"
// import { EOL } from "os"
import path from "path"
import fs from "fs-extra"


const defaultConfig = {
	padding: 5,
	borderColor: `blue`,
	borderStyle: `double`,
}

export default async function develop() {
	const directory = process.cwd()
	const args = process.argv
	const argv =
		process.argv.indexOf("--") !== -1
			? process.argv.slice(process.argv.indexOf("--") + 1)
			: []
	args.shift()
	args.shift()
	args.shift()

	const babelPath = path.join(directory, "node_modules", ".bin", "babel")

	/**
	 * Environment variable to indicate that the `start` command was initiated by the `develop`.
	 * Used to determine if Admin should build if it is installed and has `autoBuild` enabled.
	 */
	const COMMAND_INITIATED_BY = {
		COMMAND_INITIATED_BY: "develop",
	}

	const cliPath = path.join(
		directory,
		"node_modules",
		"@medusajs",
		"medusa",
		"dist",
		"bin",
		"medusa.js"
	)
	let child = fork(cliPath, [`start`, ...args], {
		execArgv: argv,
		cwd: directory,
		env: { ...process.env, ...COMMAND_INITIATED_BY },
	})

	child.on("error", function (err) {
		console.log("Error ", err)
		process.exit(1)
	})

	// RUN adim-ui package
	execSync(
		`yarn dev`,
		{
			cwd: `${directory}/custom-packages/admin-ui-custom`,
			stdio: ["pipe", process.stdout, process.stderr],
		}
	)

	watch([`${directory}/src`, `${directory}/custom-packages`], {
		ignored: [`${directory}/custom-packages/utils/dev-mode`, `${directory}/src/admin`],
	})
		.on("change", (file) => {
			const f = file.split("src")[1]
			// Logger.info(`${f} changed: restarting...`)

			if (process.platform === "win32") {
				execSync(`taskkill /PID ${child.pid} /F /T`)
			}

			child.kill("SIGINT")

			// RUN rebuilt
			execSync(
				`${babelPath} src -d dist --extensions ".ts,.js" --ignore "src/admin/**"`,
				{
					cwd: directory,
					stdio: ["pipe", process.stdout, process.stderr],
				}
			)

			// Logger.info("Rebuilt")

			child = fork(cliPath, [`start`, ...args], {
				cwd: directory,
				env: { ...process.env, ...COMMAND_INITIATED_BY },
				stdio: ["pipe", process.stdout, process.stderr, "ipc"],
			})
			child.on("error", function (err) {
				console.log("Error ", err)
				process.exit(1)
			})
		})
}

develop()
