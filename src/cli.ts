import meow from "meow";
import prompts from "prompts";
// import createLogger from "./helpers/createLogger";

import * as path from "path";
import fs from "fs-extra";

import * as isValidPath from "is-valid-path";
// import Crawler from "./Crawler.js";

import Fuse from "fuse.js";

import { CourseSearch, ScrapeOpts } from "./types.js";

import logger from "./helpers/logger.js";
import {scrape} from "./index.js";
import Crawler from "./CrawlerCluster.js";

import Bluebird from "bluebird";
Bluebird.config({ longStackTraces: true });
global.Promise = Bluebird;
// import bun from "bun";

process.on("SIGINT", () => {
    console.log("Received SIGINT");
});

process.on("exit", (code) => {
    console.log(`Process exited with code ${code}`);
});

const cli = meow(`
Usage
    $ cloudcastsdown [CourseUrl]

Options
    --email, -e         Your email.
    --password, -p      Your password.
    --directory, -d     Directory to save.
    --source, -s        Download articles or courses (Default: courses)
    --file, -f          Location of the file where are the courses
    --overwrite, -o     Overwrite if resource exists (values: 'yes' or 'no'), default value is 'no'
    --headless, -h      Enable headless (values: 'yes' or 'no'), default value is 'yes'
    --videos, -v        Enable video download (values: 'yes' or 'no'), default value is 'no'
    --concurrency, -c

Examples
    $ cloudcastsdown
    $ cloudcastsdown -a
    $ cloudcastsdown [url] [-d dirname] [-c number] [-f path-to-file]
`, {
    hardRejection: false,
    importMeta: import.meta,
    booleanDefault: undefined,
    flags: {
        help: {shortFlag: 'h'},
        version: {shortFlag: 'v'},
        all: {
            type: 'boolean',
            shortFlag: 'a'
        },
        email      : {
            type : 'string',
            shortFlag: 'e'
        },
        password   : {
            type : 'string',
            shortFlag: 'p'
        },
        directory: {
            type: 'string',
            shortFlag: 'd'
        },
        concurrency: {
            type: 'number',
            shortFlag: 'c',
            default: 10
        },
        file       : {
            type : 'string',
            shortFlag: 'f',
            default: 'no'
        },
        source: {
            type: 'string',
            shortFlag: 's',
            default: 'courses'
        },
        headless: {
            type: 'string',
            shortFlag: 'h',
            default: 'yes'
        },
        overwrite: {
            type: 'string',
            shortFlag: 'o',
            default: 'no'
        },
        videos  : {
            type: 'string',
            shortFlag: 'v',
            default: 'no'
        }
    }
})

// const oraLogger = createLogger()
// const errorHandler = err => (console.log('\u001B[1K'), oraLogger.fail(String(err)), process.exit(1))
// const errorHandler = err => (console.error(err), oraLogger.fail(String(err)), process.exit(1))
const errorHandler = (error: Error) => {
    process.kill();
    console.error(error);
    logger.error(error);
    console.log('error stack', error.stack);
    process.exit(1)
}//, process.exit(1)
const askOrExit = (question: any) => prompts({ name: 'value', ...question }, { onCancel: () => process.exit(0) }).then((r: any) => r.value);
const folderContents = async (folder: string) => {
    const files = await fs.readdir(folder);
    if (!files.length) {
        logger.warn('No files found for download by file');
        return;
    }
    logger.debug(`found some files: ${files.length} in folder: ${folder}`);
    return files.map(file => ({
        title: file,
        value: path.join(folder, file)
    }));
}

(async () => {
    const {flags, input} = cli
    logger.info(`flags:`, flags)
    let all = flags.all
    let courseUrl;

    if (all || (input.length === 0 && await askOrExit({
        type: 'confirm',
        message: 'Do you want all courses or articles?',
        initial: false
    }))) {
        all = true;
        courseUrl = 'https://cloudcasts.io/'
    } else {
        if (input.length === 0) {
            const searchOrDownload = flags.file || await askOrExit({
                type: 'confirm',
                message: 'Choose "Y" if you want to search for a course otherwise choose "N" if you have a link for download',
                initial: true
            })

            if (input.length === 0 && searchOrDownload === false) {

                input.push(await askOrExit({
                    type: 'text',
                    message: 'Enter url for download.',
                    initial: 'https://cloudcasts.io/course/a-packer-primer',
                    validate: (value: string) => value.includes('cloudcasts.io') ? true : 'Url is not valid'
                }))

            } else {
                let searchCoursesFile = false;
                if (await fs.exists(path.resolve(process.cwd(), 'json/search-courses.json'))) {
                    searchCoursesFile = true;
                }

                const foundSearchCoursesFile = await askOrExit({
                    type: (searchCoursesFile && input.length === 0 && !flags.file) ? 'confirm' : null,
                    message: 'Do you want to search for a courses from a local file (which is faster)',
                    initial: true
                })

                input.push(await askOrExit({
                    type: 'autocomplete',
                    message: 'Search for a course',
                    choices: await Crawler.searchCourses(foundSearchCoursesFile, flags.source),
                    suggest: (input: any, choices: CourseSearch[]) => {
                        const options = {
                            keys: ['title', 'value']
                        };
                        if (!input) return choices;
                        const fuse = new Fuse(choices, options)
                        return fuse.search(input).map((i: { item: any; }) => i.item);
                    },
                }))
            }
        }
        courseUrl = input[0]
    }

    // const file = flags.file || await askOrExit({
    //     type   : 'confirm',
    //     message: 'Do you want download from a file',
    //     initial: false
    // })

    const file = (['yes', 'no', 'y', 'n'].includes(flags.file)
        ? flags.file
        : await askOrExit({
            type: 'select',
            message: 'Do you want download from a file?',
            choices: [
                {
                    title: 'Yes',
                    value: 'yes'
                },
                {
                    title: 'No',
                    value: 'no'
                }
            ],
            initial: 1
        }))

    const filePath = flags.file || await askOrExit({
        type    : file ? 'autocomplete' : null,
        message : `Enter a file path eg: ${path.resolve(process.cwd(), 'json/!*.json')} `,
        choices : await folderContents(path.resolve(process.cwd(), 'json')),
        validate: isValidPath
    })

    const email = flags.email || await askOrExit({
        type    : 'text',
        message : 'Enter email',
        validate: (value: string )=> value.length < 5 ? 'Sorry, enter correct email' : true
    })
    const password = flags.password || await askOrExit({
        type    : 'text',
        message : 'Enter password',
        validate: (value: string) => value.length < 5 ? 'Sorry, password must be longer' : true
    })
    const dir = flags.directory || path.resolve(await askOrExit({
        type: 'text',
        message: `Enter a directory to save (eg: ${path.resolve(process.cwd())})`,
        initial: path.resolve(process.cwd(), 'videos/'),
        // validate: isValidPath
    }))

    const overwrite = (['yes', 'no', 'y', 'n'].includes(flags.overwrite)
        ? flags.overwrite
        : await askOrExit({
            type: 'select',
            message: 'Do you want to overwrite when the file name is the same?',
            choices: [
                {
                    title: 'Yes',
                    value: 'yes'
                },
                {
                    title: 'No',
                    value: 'no'
                }
            ],
            initial: 1
        }))

    const source = flags.source || await askOrExit({
        type: 'text',
        message: 'Do you want to download articles or courses',
        initial: 'courses'
    })

    const concurrency = flags.concurrency || await askOrExit({
        type: 'number',
        message: 'Enter concurrency',
        initial: 10
    })

    const headless = (['yes', 'no', 'y', 'n'].includes(flags.headless)
        ? flags.headless
        : await askOrExit({
            type: 'select',
            message: 'Enable headless?',
            choices: [
                {
                    title: 'Yes',
                    value: 'yes'
                },
                {
                    title: 'No',
                    value: 'no'
                }
            ],
            initial: 1
        }))

    const videos = (['yes', 'no', 'y', 'n'].includes(flags.videos)
        ? flags.videos
        : await askOrExit({
            type   : 'select',
            message: 'Include videos as well?',
            choices: [
                {
                    title: 'Yes',
                    value: 'yes'
                },
                {
                    title: 'No',
                    value: 'no'
                }
            ],
            initial: 0
        }))
    // const dir = await askSaveDirOrExit()
    // const courseUrl = input[0]
    scrape({
        all,
        email,
        password,
        source,
        logger,
        dir,
        concurrency,
        file,
        filePath,
        courseUrl,
        overwrite,
        headless,
        videos
    } as ScrapeOpts).catch(errorHandler)
})()
