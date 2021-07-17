const LOCAL_ROOT = ".";
const BUILD_DEV = "build/dev";
const BUILD_PROD = "build/prod";
const BUILD_TEMP = "build/temp";
const NODE_MODULES_PATH = "./node_modules";
const fs = require("fs"); // it's included in node.js by default, no need for any additional packages
const args = process.argv.slice(2);

process.env.NODE_ENV = args.includes("--prod") ? "production" : "development";

const isProduction = process.env.NODE_ENV === "production";
const buildFolder = isProduction ? BUILD_PROD : BUILD_DEV;
const checkForTypeErrors = !args.includes("--fast");

const reactFileSuffixDevelopment = "development";
const reactFileSuffixProd = "production.min";
const reactFileSuffix = isProduction ? reactFileSuffixProd : reactFileSuffixDevelopment;

const {build} = require("esbuild");

buildApp();

async function buildApp()
{
	console.time("Build time");

	if (checkForTypeErrors)
	{
		console.log("\x1b[33m%s\x1b[0m", "Looking for type errors...");

		try
		{
			if (isProduction)
			{
				res = exec("tsc", "--noEmit");
			}
			else
			{
				res = exec("tsc", `--incremental --composite false --tsBuildInfoFile ${BUILD_TEMP}/tsconfig.tsbuildinfo`);
			}
		}
		catch (e)
		{
			// typescript error
			process.exit(1);
		}
	}

	console.log("\x1b[33m%s\x1b[0m", "Copying static files...");

	shx(`rm -rf ${buildFolder}`);
	shx(`mkdir ${buildFolder}/`);
	shx(`cp src/index.html ${buildFolder}/index.html`);

	shx(`mkdir -p ${buildFolder}/libs/react/umd`);
	shx(`mkdir -p ${buildFolder}/libs/react-dom/umd`);

	shx(`cp ${NODE_MODULES_PATH}/react/umd/react.${reactFileSuffix}.js ${buildFolder}/libs/react/umd/react.${reactFileSuffix}.js`);
	shx(`cp ${NODE_MODULES_PATH}/react-dom/umd/react-dom.${reactFileSuffix}.js ${buildFolder}/libs/react-dom/umd/react-dom.${reactFileSuffix}.js`);

	assets(buildFolder);

	const promises = [
		buildJs(buildFolder)
	];
	if (isProduction)
	{
		promises.push(
			// shx(`sed -i 's/${reactFileSuffixDevelopment}.js/${reactFileSuffixProd}.js/g' ${buildFolder}/index.html`);
			// sed is not built-in to windows by default, so here's a cross-platform solution:
			replaceTextInFile(`${buildFolder}/index.html`, reactFileSuffixDevelopment, reactFileSuffixProd)
		);
	}

	await Promise.all(promises);

	console.log("\x1b[32m%s\x1b[0m", "Build done!");
	console.timeEnd("Build time");
}

function shx(command)
{
	const module = "shx";
	const args = command;

	return exec_module(module, args);
}

function exec_module(module, args)
{
	return exec(`"${NODE_MODULES_PATH}/.bin/${module}"`, args);
}

function exec(command, args)
{
	//console.log("command", command, args);

	args = args || "";

	// http://stackoverflow.com/questions/30134236/use-child-process-execsync-but-keep-output-in-console
	// https://nodejs.org/api/child_process.html#child_process_child_stdio

	const stdio = [
		0,
		1, // !
		2
	];

	let result;
	try
	{
		result = require("child_process").execSync(command + " " + args, {stdio: stdio});
	}
	catch (e)
	{
		// this is needed for messages to display when from the typescript watcher
		throw e;
	}

	return result;
}

function assets(buildFolder)
{
	console.log("\x1b[33m%s\x1b[0m", "Copying assets...");
	shx(`rm -rf ${buildFolder}/assets`);
	shx(`cp -R ${LOCAL_ROOT}/src/assets ${buildFolder}/assets`);
}

function readTextFile(filePath)
{
	return new Promise((resolve, reject) =>
	{
		fs.readFile(filePath, function (err, data)
		{
			if (err)
			{
				reject(err);
			}
			else
			{
				resolve(data.toString());
			}
		});
	});
}

function writeTextFile(filePath, data)
{
	return new Promise((resolve, reject) =>
	{
		fs.writeFile(filePath, data, function (err)
		{
			if (err)
			{
				reject(err);
			}
			else
			{
				resolve(data);
			}
		});
	});
}

async function replaceTextInFile(filePath, oldText, newText)
{
	// https://stackoverflow.com/questions/12398640/javascript-regex-pattern-that-contains-parentheses
	oldText = oldText.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
	const regExp = new RegExp(oldText, "g");
	const fileContent = await readTextFile(filePath);
	await writeTextFile(filePath, fileContent.replace(regExp, newText));
}

function bundleFilePath(buildFolder)
{
	return `${buildFolder}/js/app.bundle.js`;
}

function buildJs(buildFolder)
{
	const jsFile = bundleFilePath(buildFolder);

	const define = {}

	// See these for explanation: https://github.com/evanw/esbuild/issues/69
	// https://github.com/evanw/esbuild/issues/438
	for (const k in process.env)
	{
		if (!k.includes("(") && !k.includes(")"))
		{
			define[`process.env.${k}`] = JSON.stringify(process.env[k])
		}
	}

	const options = {
		entryPoints: ["./src/ts/App.tsx"],
		target: "es2017",
		minify: false,
		sourcemap: false,
		bundle: true,
		outfile: jsFile,
		define
	};

	console.log("\x1b[33m%s\x1b[0m", "Bundling js...");

	return build(options);
}