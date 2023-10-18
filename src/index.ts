
import { cpus } from "os";
// import createLogger from "./helpers/createLogger";
// import { ScrapeOpts } from "./types";
// import Crawler from "./Crawler.js";
import Crawler from "./CrawlerCluster.js";

import { ScrapeOpts } from "./types.js";

import Bluebird from "bluebird";
Bluebird.config({ longStackTraces: true });
global.Promise = Bluebird;

// {
//     all: unknown;
//     headless: unknown;
//     logger: any;
//     file: any;
//     filePath: any;
//     courseUrl: any;
//     source: unknown;
//     dir: unknown;
//     overwrite: unknown;
//     concurrency: unknown
// }
export async function scrape(opts?: ScrapeOpts): Promise<void> {
    console.time('took');
    const url = opts?.courseUrl;

    opts = normalizeOpts(opts as ScrapeOpts);
    // console.log('opts', opts);
    const { file, filePath, all } = opts ?? {};

    let crawler = new Crawler();
    const courses = file ? require(filePath as string) : await crawler.scrapeCourses({ ...opts}, url as string);
    console.log('found courses: ', courses.length);

    // return;

    const prefix = all ? 'all-courses' : 'single-course';
    const filename = `${prefix}-${new Date().toISOString().replace(/:/g , "-")}.json`;
    // await crawler.d(filename, prefix, courses, {...opts});
    // await crawler.createMarkdown(courses, url, opts);
    await crawler.writeVideosIntoFile(file as boolean, prefix, courses, filename);
    console.timeEnd('took');
};

function normalizeOpts(opts: ScrapeOpts) {
    opts.dir ??= process.cwd();
    // opts.logger ??= require('./helpers/nullLogger');
    // if (!opts.logger.isLogger) opts.logger = createLogger(opts.logger);
    opts.concurrency ??= Math.min(4, cpus().length);
    return opts;
}
