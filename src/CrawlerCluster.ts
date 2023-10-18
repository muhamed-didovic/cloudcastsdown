import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import sanitize from 'sanitize-filename';
import * as path from 'path';
// import json2md from 'json2md';
// import pRace from 'p-race';

import downOverYoutubeDL from './helpers/downOverYoutubeDL.js';

import imgs2pdf from './helpers/imgs2pdf.js';
import logger from './helpers/logger.js';
import scraper from "./helpers/scraper.js";
// import findChrome from 'chrome-finder'
import {differenceBy, orderBy, range} from "lodash-es";

import {NodeHtmlMarkdown} from 'node-html-markdown'

import ora from 'ora';

let spinner: any;

// import Spinnies from "dreidels";
// const ms = new Spinnies();
//
// import {MultiProgressBars} from "multi-progress-bars";
// const mpb = new MultiProgressBars({
//     initMessage: ' Firerip ',
//     anchor: "top",
//     persist: true,
//     progressWidth: 40,
//     numCrawlers: 7,
//     border: true,
// });

//@ts-ignore
import request from 'requestretry';
// const req = require('requestretry')
// const j = req.jar()
// const request = req.defaults({
//     jar         : j,
import {delay} from './helpers/helper.js';
//     retryDelay  : 500,
//     fullResponse: true
// })

import {Page, Puppeteer} from 'puppeteer';
import {Course, Lesson, ScrapeOpts} from './types.js';
import {Series, Lessons, DownloadedCourses, DownloadedLessons,} from './helpers/search.js';
// import downloader from "./helpers/downloadChapters.js";
// import PuppeteerHelper from "./helpers/PuppeteerHelper.js";
import PuppeteerHelper from "./helpers/PuppeteerClusterHelper.js";

// import { Worker } from "worker_threads";
import {getPosition} from "./helpers/helper.js";

// import { anySeries } from 'async';
import {Cluster} from 'puppeteer-cluster';
// const puppeteerHelper = new PuppeteerHelper();
let puppeteerHelper: PuppeteerHelper;

import Promise from 'bluebird'
import {fileURLToPath, URL} from 'url';
//@ts-ignore
const __filename = fileURLToPath(import.meta.url);
//@ts-ignore
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class CrawlerCluster {
    static async searchCourses(searchFromLocalFile: boolean) {//: Promise<Course[]>
        if (searchFromLocalFile && await fs.exists(path.resolve(process.cwd(), 'json/search-courses.json'))) {
            logger.info('LOAD COURSES FROM LOCAL SEARCH FILE');
            const courses = require(path.resolve(process.cwd(), 'json/search-courses.json'))//Series;//
            return courses.map((c: Course) => ({
                ...c,
                value: c.url,
            }))
        }

        // return 'No courses found :('
        const lessons: Course[] = await Promise
            .resolve()
            .then(async () => {

                const {body} = await request(`https://cloudcasts.io/courses`)

                const $ = cheerio.load(body)
                let courses = $('div[data-page]').data('page')

                /* {
                     id: 9,
                     title: "Understanding Lambda",
                     slug: "understanding-lambda",
                     excerpt: "Learn how to create and manage Lambda functions so you can run your code without any servers!",
                     image: "/img/courses/aws-lambda.svg",
                     free: true,
                     published_at: "2022-01-29T03:19:04.000000Z",
                     created_at: "2022-01-29T03:19:04.000000Z",
                     updated_at: "2022-02-16T15:12:13.000000Z",
                     type: "mini",
                     excerpt_html: "<p>Learn how to create and manage Lambda functions so you can run your code without any servers!</p>\n",
                     social_img: "https://cloudcasts.io/img/course-assets/understanding-lambda-social.png",
                     is_published: true,
                     listing_date: "January 29, 2022"
                 }*/

                // console.log('body:', Object.values(courses.props.courses).flat())
                return Object.values(courses.props.courses).flat().map((item: any) => {
                    return {
                        title: item.title,
                        slug:item.slug,
                        value: `https://cloudcasts.io/course/${item.slug}`,
                        url: `https://cloudcasts.io/course/${item.slug}`,
                        // course: item.title,
                        // series: item.title,
                        // position: '',
                        downPath: `${item.slug}/0-${item.slug}`
                    }
                })
                // return $('div > a.rounded-md.bg-white')
                //     .map((i, elem) => {
                //         // console.log('--', $(elem).find('h5').text().trim())
                //         // console.log($(elem).attr('href'));
                //         return {
                //             title: $(elem).find('div.font-bold').text().trim(),
                //             value: `https://cloudcasts.io/courses${ $(elem).attr('href') }`,
                //             url: `https://cloudcasts.io/courses${ $(elem).attr('href') }`
                //         }
                //     })
                //     .filter((i, elem) => !elem.title.includes('More full courses'))
                //     .get();
            })
            .then(c => c.flat())
        await fs.ensureDir(path.resolve(process.cwd(), 'json'))
        fs.writeFile(path.resolve(process.cwd(), 'json/search-courses.json'), JSON.stringify(lessons, null, 2), 'utf8')
        return lessons as Course[];

        // return Series
    }

    //@ts-ignore
    static async searchLessons(searchFromLocalFile: boolean): Promise<Lesson[]> {
        if (searchFromLocalFile && await fs.exists(path.resolve(process.cwd(), 'json/search-lessons.json'))) {
            logger.info('LOAD LESSONS FROM LOCAL SEARCH FILE');
            const courses: Lesson[] = Lessons;//require(path.resolve(process.cwd(), 'json/search-lessons.json'))
            return courses.map(c => ({
                ...c,
                value: c.url,
            }))
        }
        // return 'No courses found :('
        const lessons = await Promise
            .resolve()
            .then(async () => {
                let lessonCounter = 0;
                const lessonPages = range(1, 11); //lessons: [1, ..., 10]
                logger.log('lessonPages', lessonPages);
                const a = await Promise
                    .all(lessonPages.map(async (pageIndex: number) => {
                        logger.info(`pageIndex: ${pageIndex}`);
                        const {body} = await request(`https://fireship.io/lessons/${pageIndex === 1 ? '' : `page/${pageIndex}`}`)

                        // console.log('body', body);
                        const $ = cheerio.load(body)

                        return $('ul.grid-list.justify-items-center.pl-0 li')
                            .map((i, elem) => {
                                // logger.debug('title:', $(elem).find('h5').text().trim())
                                // logger.debug('href:', $(elem).find('a').attr('href'));
                                const title = sanitize($(elem).find('h5').text().trim());
                                return {
                                    title,
                                    value: `https://fireship.io${$(elem).find('a').attr('href')}`,
                                    url: `https://fireship.io${$(elem).find('a').attr('href')}`,
                                    course: `Lessons/${title}`,
                                    series: path.join(`Lessons`, title),
                                    position: '',//++lessonCounter,
                                    downPath: `Lessons/${title}`
                                }
                            })
                            .get()
                    }))
                logger.log('lessonCounter', lessonCounter);
                // logger.log('a', a);
                return a;
            })
            .then(c => c.flat())
        await fs.ensureDir(path.resolve(process.cwd(), 'json'))
        fs.writeFile(path.resolve(process.cwd(), 'json/search-lessons.json'), JSON.stringify(lessons, null, 2), 'utf8')
        return lessons.flat() as Lesson[];
    }

    /**
     *
     * @param page
     * @param opts
     */
    async loginAndRedirect(page: Page, opts: ScrapeOpts) {
        logger.debug('Starting login step');
        const login = 'https://cloudcasts.io/login';
        await page.goto(login, {timeout: 19e3}); //, { waitUntil: 'networkidle0' }
        const url = await page.evaluate(() => location.href);
        logger.debug('wait for login form and inputs, and we are on page:', url);
        // await fs.ensureDir(path.join(__dirname, '../debug'))
        // await page.screenshot({
        //     path: path.join(__dirname, `../debug/login-form-${new Date().toISOString()}.png`),
        //     fullPage: true
        // });

        await page.waitForSelector('#email');
        await page.focus('#email');
        await page.keyboard.type(opts.email);

        //dc-flash--error
        await page.waitForSelector('#password', {
            timeout: 11e3,
            visible: true
        });
        await page.focus('#password');
        await page.keyboard.type(opts.password);

        await page.click('button');
        logger.debug('form is filled');

        await page.waitForSelector('#app > div > div.min-h-screen > header > div > h2', {timeout: 63e3});
        // const a = Array.from(document.body.querySelectorAll('h3[name="selenium-welcome-back-text"]'), txt => txt.textContent)[0]
        let mainTitle = await page.evaluate(() => Array.from(document.body.querySelectorAll('#app > div > div.min-h-screen > header > div > h2'), txt => txt.textContent)[0]);
        logger.debug('main title on a page:', mainTitle);
        // let url = await page.url();
        const browserPage = await page.evaluate(() => location.href);
        logger.debug(`browserPage ${browserPage}`);
        //check if we are on profile page
        // if (!browserPage.includes('/learn')) {
        //     logger.warn('[warn] Wrong page!!!')
        //     throw new Error('Wrong page!!!')
        // }
        logger.debug('Login step done');
    }

    /**
     *
     * @param page
     * @param link
     * @param url
     * @returns {Promise<*>}
     */
    async getCoursesForDownload(page: Page, link: string | any[], {all}: any) {
        logger.info('[getCoursesForDownload] link:', link);
        // let series = require(path.resolve(process.cwd(), 'json/search-courses.json'));
        // if (await fs.exists(path.resolve(process.cwd(), 'json/search-courses.json'))) {//!all &&
        //     console.log('LOAD COURSE FROM LOCAL FILE');
        //     series = require(path.resolve(process.cwd(), 'json/search-courses.json'))
        //     const foundCourse = specialCourses.find(({ url }) => link.includes(url))
        //     if (foundCourse) {
        //         console.log('course is founded:', foundCourse.url);
        //         return [foundCourse]
        //     }
        // }
        // return all ? series : ([series.find(({url}) => link.includes(url)) ?? link])
        let links = require(path.join(__dirname, '../json/search-courses.json'))//Series;//
        logger.debug('Total number of courses found:', links.length);//, links
        //remove courses that are downloaded already
        if (await fs.exists(path.join(__dirname, '../json/downloaded-courses.json'))) {
            // const downloadedCourses = downloaded;//await require(path.join(__dirname, '../json/downloaded-courses.json'))
            links = differenceBy(links, DownloadedCourses, 'url')
            logger.debug('Remaining courses to be downloaded:', links.length);
        }

        return all ? links : [Series.find(({url}) => link.includes(url as string))]//series.find(link => url.includes(link.url))
    }

    /**
     *
     * @param page
     * @param course
     * @param opts
     * @returns {Promise<*|boolean|string|void>}
     */
    async getLessons(page: Page, course: Course, opts: ScrapeOpts) {
        logger.debug('[getLessons] for course:', course);
        /*{
          title: 'A Packer Primer',
          value: 'https://cloudcasts.io/course/a-packer-primer',
          url: 'https://cloudcasts.io/course/a-packer-primer',
          course: 'A Packer Primer',
          series: 'A Packer Primer'
        }*/
        // console.log('getting lessons for course:', course);
        // ms.update('info', { text: `Checking ${course.url} for ${lessons.flat().length} lessons` })
        await page.goto(`${course.url}`) // , { waitUntil: 'networkidle0' }

        await page.waitForSelector('div[data-page]')
        const jsonData: any = await page.$eval('div[data-page]', (element: any) => {
            return JSON.parse(element.getAttribute('data-page'));
        });
        logger.info('[getLessons] lessons:::', jsonData.props.course?.modules.map((item: any) => item.lessons).flat().length);//

        const courseFromJson = jsonData.props.course;
        let lessons = courseFromJson?.modules.map((item: any) => {
            return item.lessons.map((i: Lesson) => {
                return ({
                    //https://cloudcasts.io/course/a-packer-primer/introduction
                    url: `https://cloudcasts.io/course/${courseFromJson.slug}/${i.slug}`,
                    title: i.slug,
                    series: courseFromJson.slug,
                    downPath: `${courseFromJson.slug}/${item.pivot.order}-${item.slug}`,
                    modulePath: `${item.pivot.order}-${item.slug}`,
                    position: i.order,
                    slug: i.slug
                })
            })
        }).flat();// as Lesson[]

        //change path so all files are in same folder
        course.downPath = lessons[0].downPath;
        const [,, m,] = await Promise.all([
            (async () => {
                try {

                    // let lessons = await page.evaluate(() => {
                    //     const series = Array.from(document.body.querySelectorAll('header > h1'), txt => txt.textContent)[0]
                    //     const links = Array.from(document.body.querySelectorAll("a[data-item=\"exercise\"]")) as HTMLAnchorElement[];
                    //     return links.map((a: HTMLAnchorElement, i: number) => {
                    //         return ({
                    //             url: a.href,
                    //             title: a.querySelector('h5')?.innerText
                    //                 ?.replace(/\\W+/g, '')
                    //                 ?.replace(/(\r\n|\n|\r)/gm, '')
                    //                 ?.replace(/[/\\?%*:|"<>]/g, '')
                    //                 ?.trim(),
                    //             series,
                    //             downPath: series,
                    //             position: ++i
                    //         })
                    //     })
                    // })

                    // course: {
                    //     id: 1,
                    //         title: 'A Packer Primer',
                    //         slug: 'a-packer-primer',
                    //         excerpt: 'Use Packer to build server images with everything you need, configured how you want.\n' +
                    //     '\n' +
                    //     "We'll use these base images in other courses.",
                    //         image: '/img/courses/packer.svg',
                    //         free: true,
                    //         published_at: '2021-05-19T01:44:27.000000Z',
                    //         created_at: '2021-05-19T01:44:27.000000Z',
                    //         updated_at: '2021-05-19T01:44:27.000000Z',
                    //         type: 'full',
                    //         excerpt_html: '<p>Use Packer to build server images with everything you need, configured how you want.</p>\n' +
                    //     "<p>We'll use these base images in other courses.</p>\n",
                    //         social_img: 'https://cloudcasts.io/img/course-assets/a-packer-primer-social.png',
                    //         is_published: true,
                    //         listing_date: 'May 19, 2021',
                    //         product: [],
                    //         modules: [Array]
                    // },

                    // {
                    //     id: 1,
                    //         title: 'Using Packer',
                    //     slug: 'using-packer',
                    //     published_at: '2021-05-19 01:44:27',
                    //     created_at: '2021-05-19T01:44:27.000000Z',
                    //     updated_at: '2021-05-19T01:44:27.000000Z',
                    //     pivot: { course_id: 1, module_id: 1, order: 1 },
                    //     lessons: [
                    //         [Object]
                    //     ]
                    // }

                    //save json data for course
                    await fs.ensureDir(path.join(process.cwd(), `json/${course.slug}`))
                    fs.writeFile(path.join(process.cwd(), `json/${course.slug}/course-${course.slug}.json`), JSON.stringify(courseFromJson, null, 2), 'utf8')

                    // logger.info('[getLessons] transformed lessons:', lessons);
                    //return lessons as unknown as Lesson[];
                } catch (e) {
                    logger.error('[getLessons] error with getLessons method lessons', e)
                    return false;
                }
            })(),
            this.makeScreenshotAndScrape(page, '0', course as Lesson, opts), //main course page
            (async () => {
                const courseFromJSON = jsonData.props.course;
                const markdown = courseFromJSON?.excerpt + '\n' + courseFromJSON?.excerpt_html;
                const dest = path.join(opts.dir, course.downPath)
                const title = `${courseFromJSON.slug}-json`;
                this.createMarkdown(dest, course as Lesson, 0, title, markdown )
                // try {
                //     await page.waitForSelector('video-player', {
                //         timeout: 10e3
                //     })
                //     logger.info('[getLessons] found iframe on a page')
                //     // console.log('ima iframe:', lesson.url);
                //     // Does exist
                // } catch (e: any) {
                //     logger.error('[getLessons] error with video-player on course page, no video found:', e.message)
                //     return;
                // }
                //
                // const vimeoUrl = await this.extractVimeoFromIframe(page, course.url as string);
                // const chapters = [
                //     {
                //         series: course.title,
                //         title: `00-${ course.title }.mp4`,
                //         position: 0,
                //         downPath: course.title,
                //         vimeoUrl
                //     }
                // ]
                // logger.debug('[getLessons] getLessons chapters:', chapters)
                // // await downloader({chapters, mpb, ...opts })
                // await this.d({ courses: chapters, ...opts });
            })(),
        ])
        logger.log('----------------------------------------------------------------', m)
        if (lessons) {
            logger.debug('[getLessons] ending with lessons length:', lessons.length, lessons);
        } else {
            logger.debug('[getLessons] ending with no lessons found');
        }
        return lessons

    }

    /**
     *
     * @param opts
     * @param url
     * @returns {Promise<*>}
     */
    async scrapeCourses(opts: ScrapeOpts, url: string) {
        puppeteerHelper = new PuppeteerHelper(opts)
        const {source, dir, concurrency, overwrite} = opts
        // ms.add('info', { text: `Get course: ${url}` })
        // spinner = ora(`Get course: ${url}`).start()
//todo:
//2. embed video into html/lesson
//3. create pdf from html/lesson
        // updateDoc, setDoc
        return await puppeteerHelper.withBrowser(async (cluster: Cluster) => {
            await cluster.task(async ({page, data}) => {
                logger.log('[scrapeCourses] inside task method')
                const {opts, dir, source} = data;
                logger.log('[scrapeCourses] downloading source:', source)
                // return await this.scrapeLessons(cluster, page, url, opts, dir);
                return source === 'courses'
                    ? await this.downloadCourses(cluster, page, url, opts, dir)
                    : await this.scrapeLessons(cluster, page, url, opts, dir)
            });

            // // Use the withPage method to run a function with a page
            // await puppeteerHelper.withPage(async page => {
            //     // Your code here
            // });
            logger.log('[scrapeCourses] before execute method')
            return await cluster.execute({url, opts, concurrency, dir, source})
        });
    }

    /**
     *
     * @param cluster
     * @param page
     * @param url
     * @param opts
     * @param dir
     * @returns {Promise<*[]>}
     */
    async scrapeLessons(cluster: any, page: Page, url: any, opts: any, dir: string) {
        const links = await CrawlerCluster.searchLessons(false);

        logger.debug('[scrapeLessons] Found total lessons:', links.length)
        let lessons: Lesson[] = [];
        if (await fs.exists(path.join(__dirname, '../json/downloaded-courses.json'))) {
            lessons = (differenceBy(links, DownloadedLessons, 'url')) as Lesson[];
            logger.debug('Remaining lessons to be downloaded:', lessons.length);
        }
        if (!lessons.length) {
            logger.debug('[scrapeLessons] All lessons are downloaded')
            return lessons;
        }

        const l = await Promise
            .resolve()
            .then(async () => await this.extractLessonsData(cluster, ({
                course: 'lessons',
                series: 'series'
            }) as Course, lessons, opts, DownloadedLessons, path.join(__dirname, `../json/downloaded-lessons.json`)))
            .then(c => c.flat()
                .filter(Boolean)
                .filter((item: {
                    vimeoUrl: any;
                }) => item?.vimeoUrl)
            )
            .then(async items => {
                logger.debug('items', items);
                // ms.update('info', { text: `----lessons>>> ${items[0].series} has ${items.length} lessons for download` })
                // spinner.text = `----lessons>>> ${items[0].series} has ${items.length} lessons for download`;
                await Promise.all([
                    (async () => {
                        //check what is scraped from pages
                        await fs.ensureDir(path.resolve(process.cwd(), 'json'))
                        fs.writeFile(path.resolve(process.cwd(), `json/lesson-${new Date().toISOString()}.json`), JSON.stringify(items, null, 2), 'utf8')
                    })(),
                    // (async () => {
                    //     await this.d({courses: items, ...opts});
                    //     logger.debug('DONE download!!!');
                    // })(),
                    (async () => {
                        logger.debug('saving images to pdf', path.join(dir, items[0].downPath, 'screenshots'));
                        let dest = path.join(dir, items[0].downPath, 'screenshots')
                        await fs.ensureDir(dest)
                        await imgs2pdf(
                            path.join(dest),
                            path.join(dest, `${items[0].series}.pdf`)
                        )
                        logger.debug('DONE img2pdf!!!');
                    })(),
                ])
                logger.debug('DONE');
                return items;
            })

        // ms.succeed('info', { text: `Found: ${lessons.length} lessons` })
        // spinner.text = `Found: ${l.length} lessons`;
        await fs.ensureDir(path.resolve(process.cwd(), 'json'))
        fs.writeFile(path.resolve(process.cwd(), 'json/test-lessons.json'), JSON.stringify(lessons, null, 2), 'utf8')

        return lessons
    }

    async downloadCourses(cluster: any, page: Page, url: string, opts: ScrapeOpts, dir: string) {
        logger.debug('[downloadCourses] url:', url);
        await this.loginAndRedirect(page, opts);
        const courses = (await this.getCoursesForDownload(page, url, opts)) as Course[];
        logger.debug('[downloadCourses] Number of courses to be downloaded:', courses.length, courses);//

        if (!courses?.length) {
            logger.debug('[downloadCourses] No courses found, check if it is already downloaded!!!!');
            return [];
        }

        const lessons = await Promise
            .mapSeries(courses, async (course: Course) => {
                logger.info('[downloadCourses] Course:', course)
                course.course = sanitize(course.slug)
                course.series = sanitize(course.slug)
                const lessons = (await this.getLessons(page, course, opts)) as Lesson[];

                logger.debug(`[downloadCourses] Found: ${lessons.length} lessons for course: ${course.url}`);

                if (!lessons?.length) {
                    logger.debug(`[downloadCourses] No lessons found for url: ${course.url}!!!!`);
                    return [];
                }

                const chapters = await this.extractLessonsData(cluster, course, lessons, opts, DownloadedCourses, path.join(__dirname, `../json/downloaded-courses.json`));

                logger.info('[downloadCourses] chapters length:', chapters.length)

                return chapters
            })
            /*.then(async c => c.flat())
            .filter(Boolean)
            .filter(item => item?.vimeoUrl)*/
            .then((c: any[]) => c.flat()
                .filter(Boolean)
                .filter((item: {
                    vimeoUrl: any;
                }) => item?.vimeoUrl)
            )
            .then(async (items: string | any[]) => {
                logger.debug(`[downloadCourses] ${items.length} lessons for download`)//, items
                // spinner.text = `---- ${items[0].series} has ${items.length} lessons for download`;
                // ms.update('info', { text: `---- ${items[0].series} has ${items.length} lessons for download` })
                await Promise.all([
                    (async () => {
                        //check what is scraped from pages
                        await fs.ensureDir(path.resolve(process.cwd(), 'json'))
                        fs.writeFile(path.resolve(process.cwd(), `json/test-${new Date().toISOString()}.json`), JSON.stringify(items, null, 2), 'utf8')
                    })(),
                    /*(async () => {
                        //download videos
                        // await this.d({ courses: items, ...opts });
                    })(),*/
                    (async () => {
                        // await imgs2pdf(
                        //     path.join(opts.dir, course.title),
                        //     path.join(opts.dir, course.title, `${course.title}.pdf`))
                        logger.debug('[downloadCourses] saving images to pdf', path.join(dir, items[0].downPath, 'screenshots'));
                        let dest = path.join(dir, items[0].downPath, 'screenshots')
                        await fs.ensureDir(dest)
                        await imgs2pdf(
                            path.join(dest),
                            path.join(dest, `${items[0].series}.pdf`)
                        )
                    })(),
                ])

                return items;
            })


        // ms.succeed('info', { text: `Found: ${lessons.length} lessons` })
        // spinner.text = `Found in downloadCourses method ${lessons.length} lessons`;
        await fs.ensureDir(path.resolve(process.cwd(), 'json'))
        fs.writeFile(path.resolve(process.cwd(), 'json/test.json'), JSON.stringify(lessons, null, 2), 'utf8')

        return lessons
    }

    async extractLessonsData(cluster: Cluster, course: Course, lessons: Lesson[], opts: ScrapeOpts, downloadedResources: any, filePath: string) {
        logger.debug('[extractLessonsData] lessons length:', lessons.length);
        const scrapeLesson = async ({page, data}: {
            page: Page,
            data: any
        }) => {
            page.setDefaultTimeout(0)
            page.setDefaultNavigationTimeout(0);
            const {index, lessons, lesson, opts} = data;
            logger.debug(`[extractLessonsData] scraping: ${lesson.position}/${lessons.length} - ${lesson.url} - ${lesson.title}`);
            delay(1e3)
            // ms.update('info', { text: `scraping: ${index} - ${lesson.url} - ${lesson.title}, Lesson: ${lesson.url} - ${lesson.title}` })
            // spinner.text = `scraping: ${index} - ${lesson.url} - ${lesson.title}, Lesson: ${lesson.url} - ${lesson.title}`;
            await page.goto(lesson.url)//, { waitUntil: 'networkidle0' }
            //await this.applyHackAndExtractInfo(page, opts);

            //get data from page
            await page.waitForSelector('div[data-page]')
            const jsonData: any = await page.$eval('div[data-page]', (element: any) => {
                return JSON.parse(element.getAttribute('data-page'));
            });
            const lessonJsonData = jsonData.props.lesson;
            // console.log('jsonData', jsonData.props.lesson);

            //save json data for lesson
            await fs.ensureDir(path.join(process.cwd(), `json/${jsonData.props.course.slug}`))
            fs.writeFile(path.join(process.cwd(), `json/${jsonData.props.course.slug}/course-${jsonData.props.course.slug}-lesson-${lessonJsonData.slug}.json`), JSON.stringify(jsonData.props.course, null, 2), 'utf8')

            // const courseFromJSON = jsonData.props.course;
            const markdown = (lessonJsonData?.meta?.github_link ? `##Code:${lessonJsonData.meta.github_link}` : '')
                + '\n' + lessonJsonData?.excerpt_html
                + '\n' + lessonJsonData?.body_html;
            const dest = path.join(opts.dir, lesson.downPath)
            await this.createMarkdown(dest, lesson, lesson.position, `${lesson.title}-json`, markdown )

            // const course = jsonData.props.course;
            // let lessons = course?.modules[0].lessons.map((item: any) => {
            //     return ({
            //         //https://cloudcasts.io/course/a-packer-primer/introduction
            //         url: `https://cloudcasts.io/course/${course.slug}/${item.slug}`,
            //         title: item.slug,
            //         series: course.slug,
            //         downPath: course.slug,
            //         position: item.order
            //     })
            // });

            logger.debug('[extractLessonsData scrapeLesson] making screenshots');
            const m = await this.makeScreenshotAndScrape(page, lesson.position, lesson, opts)
            logger.log('----------------------------------------------------------------', m)
            // await delay(2e3)

            let vimeoUrl: any;
            try {
                vimeoUrl = `https://player.vimeo.com/video/${lessonJsonData.video}?quality=true&app_id=122963`
                logger.info('[extractLessonsData scrapeLesson] vimeoUrl:', vimeoUrl)
                /*lesson: {
                    id: 7,
                    module_id: 1,
                    title: "Launching an Instance",
                    slug: "launching-an-instance",
                    excerpt: "We use our latest AMI and launch an instance with it.",
                    body: "We'll use the AMI we just created and create a new EC2 instance from it. Then we see if our little application will run based on our configuration.",
                    video: "520753389",
                    order: 7,
                    published_at: "2021-05-19 01:44:27",
                    created_at: "2021-05-19T01:44:27.000000Z",
                    updated_at: "2021-06-08T14:20:40.000000Z",
                    meta: {
                        github_link: "https://github.com/cloudcastsapp/packer-course",
                        duration: 136
                    },
                    excerpt_html: "<p>We use our latest AMI and launch an instance with it.</p>\n",
                    body_html: "<p>We'll use the AMI we just created and create a new EC2 instance from it. Then we see if our little application will run based on our configuration.</p>\n"
                },*/
                if (!vimeoUrl) {
                    logger.error(`[extractLessonsData] No vimeo url found for lesson:${lesson.url}`)
                    //return
                    throw new Error(`No vimeo found for lesson:${lesson.url}`)
                }
                logger.debug('[extractLessonsData] found iframe:', vimeoUrl, lesson.url);
            } catch (err) {
                logger.error('[extractLessonsData] not iframe or vimeo found:', lesson.url, err);
                await this.addAsDonwloaded(opts.source === 'courses' ? course : lesson, downloadedResources, filePath);
                return this.extractVideos({
                    course: {
                        index,
                        vimeoUrl,
                        ...lesson,
                    }
                })
            }

            // await delay(2e3)
            // await this.makeScreenshotAndScrape(browser, page, lesson.position, lesson, opts)
            // logger.info('vimeoUrl: ', vimeoUrl)

            const l = this.extractVideos({
                course: {
                    index,
                    vimeoUrl,
                    ...lesson,
                }
            })
            logger.info('[extractLessonsData scrapeLesson] vimeoUrl: ', vimeoUrl)
            await Promise.all([
                // (async () => {
                //
                // })(),
                (async () => {
                    logger.debug('[extractLessonsData scrapeLesson] start download, videos options:', opts.videos);
                    const chapters = [l]
                    // await downloader({chapters, mpb, ...opts })
                    opts.videos === 'yes' && await this.d({courses: chapters, ...opts});
                })(),
            ])

            await this.addAsDonwloaded(opts.source === 'courses' ? course : lesson, downloadedResources, filePath);

            return l;
        }

        return await Promise
            .map(lessons/*.slice(0, 1)*/, async (lesson: any, index: any) => {
                return await cluster.execute({index, lessons, lesson, opts}, scrapeLesson);
                // return await cluster.task({index, lessons, lesson, opts}, scrapeLesson);
            }, {concurrency: 7})//opts.concurrency
    }

    /**
     *
     * @param resource
     * @param downloadedResources
     * @param filePath
     * @returns {Promise<void>}
     */
    async addAsDonwloaded(resource: {
        url: string | any[];
    }, downloadedResources: any[], filePath: string | fs.PathLike) {
        // filePath = path.join(__dirname, `../json/downloaded-courses.json`)
        if (await fs.exists(filePath)) {
            logger.debug('add course as downloaded', resource);
            // const downloadedCourses = downloaded;//require(path.join(__dirname, '../json/downloaded-courses.json'))
            const foundCourse = downloadedResources.find(({url}) => resource.url.includes(url))
            if (!foundCourse) {
                logger.debug('-->adding coure:', foundCourse);
                downloadedResources.push(resource);
                fs.writeFile(filePath, JSON.stringify(downloadedResources, null, 2), 'utf8')
            }
        } else {
            fs.writeFile(filePath, JSON.stringify([resource], null, 2), 'utf8')
        }
    }

    async makeScreenshotAndScrape(page: Page, position: string, lesson: Lesson, opts: ScrapeOpts) {
        logger.log(`[makeScreenshotAndScrape] lesson:`, {lesson})
        const title = sanitize(lesson.slug)
        console.log('11');
        let series = sanitize(lesson.series) //sanitize(course.title)
        // console.log('222', path.join(opts.dir, lesson.downPath));
        const dest = path.join(opts.dir, lesson.downPath)
        console.log('333');
        logger.log('[makeScreenshotAndScrape] series:', series, 'dest:', dest);
        //const src = (await fetch(`https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F${vimeoId}&id=${vimeoId}`).then(r => r.json())).html.split("src=\"")[1].split("\"")[0];

        // await delay(1e3)
        const directory = path.join(dest, 'html', sanitize(`${getPosition(position)}${title}`))
        logger.info('[makeScreenshotAndScrape] directory::::', directory);
        return await scraper(opts, page, directory, lesson, position)
        // await this.createHtmlPage(page, dest, position, title)

    }

    /**
     *
     * @param opts
     * @returns {Promise<void>}
     */
    async d(opts: any) {
        const {
            courses,
            logger,
            concurrency,
            file,
            filePath
        } = opts

        let cnt = 0
        //logger.info(`Starting download with concurrency: ${concurrency} ...`)
        await Promise.map(courses, async (course: any, index: string | number) => {
            if (course.done) {
                logger.debug('DONE for:', course.title)
                cnt++
                return
            }
            /*if (!course.vimeoUrl) {
                throw new Error('Vimeo URL is not found')
            }*/

            // if (!course?.downPath) {
            //     logger.debug('dest:', opts.dir, course.downPath)
            //     logger.debug('cccccc', course)
            // }
            logger.info('[d] before download course:', course)
            const dest = path.join(opts.dir, course.downPath)
            fs.ensureDir(dest)

            // let ytl-dp decide if file is downloaded or not
            // const details = await this.getSizeOfVideo(course)
            const details = {
                size: -1,
                url: course.vimeoUrl
            }
            await downOverYoutubeDL(details, path.join(dest, course.title), {
                ...opts,
                downFolder: dest,
                index
            })

            if (file) {
                courses[index].done = true
                fs.writeFile(filePath, JSON.stringify(courses, null, 2), 'utf8')
            }
            // cnt++
        }, {
            concurrency//: 1
        })
        //ms.stopAll('succeed');
        //logger.succeed(`Downloaded all videos for '${prefix}' api! (total: ${cnt})`)
    }

    /**
     *
     * @param file
     * @param prefix
     * @param courses
     * @param filename
     * @returns {Promise<void>}
     */
    async writeVideosIntoFile(file: boolean, prefix: string, courses: string | any[], filename: string) {
        if (!file) {
            fs.writeFile(path.join(process.cwd(), `json/${filename}`), JSON.stringify(courses, null, 2), 'utf8')
            // logger.info(`json file created with lessons ...`)
            // spinner.text = 'json file created with lessons ...';
        }
        // logger.succeed(`Downloaded all videos for '${prefix}' api! (total: ${courses.length})`)
        logger.info(`Downloaded all videos for '${prefix}' api! (total: ${courses.length})`);
        // spinner.succeed(`Downloaded all videos for '${prefix}' api! (total: ${courses.length})`)
        //return courses
    }

    /**
     *
     * @param url
     * @param sourceUrl
     * @returns {Promise<{size: string | undefined, url: *}>}
     */
    async vimeoRequest(url: any, sourceUrl: any) {
        try {
            const {body, attempts} = await request({
                url,
                maxAttempts: 50,
                headers: {
                    'Referer': "https://fireship.io/",
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36'
                }
            })

            const v = this.findVideoUrl(body, url, sourceUrl)
            if (!v) {
                return {
                    size: -1,
                    url: url
                }
            }

            logger.debug('[vimeoRequest] attempts', attempts);
            const {headers, attempts: a} = await request({
                url: v,
                json: true,
                maxAttempts: 50,
                method: "HEAD",
                fullResponse: true, // (default) To resolve the promise with the full response or just the body
                headers: {
                    'Referer': "https://fireship.io/"
                }
            })

            return {
                url: v,//url
                size: headers['content-length']
            };
        } catch (err) {
            logger.error('[vimeoRequest] ERR::', err);
            logger.error('[vimeoRequest] err url:', url);
            /*if (err.message === 'Received invalid status code: 404') {
                return Promise.resolve();
            }*/
            throw err;
        }
    }

    /**
     *
     * @param str
     * @param url
     * @param sourceUrl
     * @returns {null|*}
     */
    /**
     *
     * @param str
     * @param url
     * @param sourceUrl
     * @returns {string|null}
     */
    findVideoUrl(str: string, url: any, sourceUrl: any) {
        const regex = /(?:playerConfig = )(?:\{)(.*(\n.*?)*)(?:"\})(;)/gm;
        let res = regex.exec(str);
        let config: string | undefined;
        if (res !== null) {
            if (typeof res[0] !== "undefined") {
                try {
                    config = res[0].replace('playerConfig = ', '');
                    config = config.replace(/(;\s*$)/g, '');
                    const configParsed = JSON.parse(config);
                    let progressive = configParsed.request.files.progressive;
                    if (!progressive.length) {
                        logger.error('[findVideoUrl] error:', url, sourceUrl);
                        return null;
                    }
                    let video = orderBy(progressive, ['width'], ['desc'])[0];
                    return video.url;
                } catch (err) {
                    logger.debug('[findVideoUrl] error with findVideoUrl:', err);
                    logger.debug('[findVideoUrl] json config:', config);
                    throw err;
                }

            }
        }
        return null;
    }

    /**
     *
     * @param browser
     * @returns {Promise<boolean>}
     */
    async isHeadlessMode(browser: {
        userAgent: () => any;
    }) {
        // const u = await page.evaluate('navigator.userAgent');
        const ua = await browser.userAgent()
        logger.info('UA::', ua, ua.toLowerCase().includes('headlesschrome'))
        return ua.toLowerCase().includes('headlesschrome')
    }

    /**
     *
     * @param browser
     * @param page
     * @param dest
     * @param position
     * @param title
     * @returns {Promise<void>}
     */
    async createPdf(page: Page, dest: string, position: string | number, title: string) {
        logger.debug(`[pdf] entering createPdf [source]: ${title}`)
        /*if (!await this.isHeadlessMode(browser)) {
            console.log('headless mode is set off!!!')
            return
        }*/
        await this.retry(async () => {
            await fs.ensureDir(path.join(dest, 'pdf'))
            await page.pdf({
                path: path.join(dest, 'pdf', sanitize(`${getPosition(position)}${title}.pdf`)),
                printBackground: true,
                format: "Letter",
                timeout: 93e3,
            });
            logger.debug(`[pdf] ending createPdf [source]: ${title}`)
        }, 6, 1e3, true, page);
    }

    /**
     *
     * @param page
     * @param dest
     * @param position
     * @param title
     * @returns {Promise<void>}
     */
    async createHtmlPage(page: {
        content: () => any;
    }, dest: string, position: string | number, title: any) {
        await fs.ensureDir(path.join(dest, 'html'))
        //save html of a page
        const html = await page.content();
        fs.writeFile(path.join(dest, 'html', sanitize(`${getPosition(position)}${title}.html`)), html);
        await delay(1e3)
    }

    /**
     *
     * @param page
     * @param dest
     * @param position
     * @param title
     * @returns {Promise<void>}
     */
    async createFullPageScreenshot(page: Page, dest: string, position: number, title: any) {
        logger.debug(`[createFullPageScreenshot]  entering createFullPageScreenshot [source]: ${title}`)
        await fs.ensureDir(dest)
        await page.screenshot({
            path: path.join(dest, sanitize(`${getPosition(position)}${title}.png`)),//-full.png
            fullPage: true
        });
    }

    async createMarkdown(dest: string, lesson: Lesson, position: number | string, title: string, markdown: any) {
        logger.debug(`[createMarkdown] entering [source]: ${lesson.url}`)
        const nhm = new NodeHtmlMarkdown();

        await fs.ensureDir(path.join(dest, 'markdown'))
        fs.writeFile(path.join(dest, 'markdown', sanitize(`${getPosition(position)}${title}.md`)), nhm.translate(markdown), 'utf8')
        await delay(1e3)
        logger.debug(`[createMarkdown] ending [source]: ${lesson.url}`)
    }
    /**
     *
     * @param page
     * @param dest
     * @param lesson
     * @param position
     * @param title
     * @returns {Promise<void>}
     */
    async createMarkdownFromHtml(page: Page, dest: string, lesson: Lesson, position: number | string, title: string) {
        logger.debug(`[markdown] entering createMarkdownFromHtml [source]: ${lesson.series}`)
        const nhm = new NodeHtmlMarkdown();
        //let position = index + 1
        const markdown = await Promise.race([
            (async () => {
                // check is lesson page
                try {
                    await page.waitForSelector('section:not(#qna)')
                    let markdown = await page.evaluate(() => Array.from(document.body.querySelectorAll("section"), txt => txt.outerHTML)[0]);
                    return markdown;
                } catch (e) {
                    return false;
                }

            })(),
            (async () => {
                // check is home page of course
                try {
                    await page.waitForSelector('article')
                    let markdown = await page.evaluate(() => Array.from(document.body.querySelectorAll("article"), txt => txt.outerHTML)[0]);
                    return markdown;
                } catch (e) {
                    return false;
                }

            })(),
        ])

        if (!markdown) {
            logger.error('[markdown]  -----------------nema markdown [source]: ${lesson.course}', title);
            await this.createFullPageScreenshot(page, path.join(dest, sanitize(lesson.series), 'error'), 0, title);
            // throw new Error(`No Markdown found - ${title}`)
            return;
        }
        await fs.ensureDir(path.join(dest, 'markdown'))
        fs.writeFile(path.join(dest, 'markdown', sanitize(`${getPosition(position)}${title}.md`)), nhm.translate(markdown), 'utf8')
        await delay(1e3)
        logger.debug(`[markdown] ending createMarkdownFromHtml [source]: ${lesson.series}`)
    }

    /**
     *
     * @param course
     * @param ms
     * @param index
     * @param total
     * @returns {bluebird<{series: string, downPath: string, position: number | string, title: string, url: string}>}
     */
    /**
     * Extracts video information from a course object.
     * @param {Object} param0 - The course object.
     * @param {Object} param0.course - The course object.
     * @returns {Object} - The extracted video information.
     */
    extractVideos({course}: {
        course: {
            series: string,
            title: string,
            position: number | string,
            downPath: string,
            vimeoUrl: string,
            markdown: string
        }
    }): {
        series: string,
        title: string,
        position: number | string,
        downPath: string,
        vimeoUrl: string,
        markdown: string
    } {
        let series: string = sanitize(course.series)
        logger.log(`[extractVideos] entering [source]: `, course)
        let title: string = sanitize(`${getPosition(course?.position)}${course.title}.mp4`)
        let downPath: string = course.downPath

        return {
            series,
            title,
            position: course?.position,
            downPath,
            vimeoUrl: course.vimeoUrl,
            markdown: course.markdown
        }
    }

    /**
     *
     * @param course
     * @returns <string> url
     * @private
     */
    async getSizeOfVideo(course: {
        vimeoUrl: any;
        title: any;
        course: any;
    }) {
        const vimeoUrl = course.vimeoUrl

        try {
            //@ts-ignore
            const {headers, attempts: a} = await request({
                url: vimeoUrl, //v,
                json: true,
                maxAttempts: 50,
                method: 'HEAD',
                fullResponse: true, // (default) To resolve the promise with the full response or just the body
            })
            logger.debug(`[getSizeOfVideo] url: ${vimeoUrl} with size: ${headers['content-length']} [source]: ${course.title}`)
            return {
                url: vimeoUrl, //v
                size: headers['content-length']
            }
        } catch (err) {
            logger.error(`[getSizeOfVideo] getSizeOfVideo [source]: ${course.course} ERR::`, err)
            /*if (err.message === 'Received invalid status code: 404') {
                return Promise.resolve();
            }*/
            throw err
        }
    };

    /**
     * Retries the given function until it succeeds given a number of retries and an interval between them. They are set
     * by default to retry 5 times with 1sec in between. There's also a flag to make the cooldown time exponential
     * @author Daniel Iñigo <danielinigobanos@gmail.com>
     * @param {Function} fn - Returns a promise
     * @param {Number} retriesLeft - Number of retries. If -1 will keep retrying
     * @param {Number} interval - Millis between retries. If exponential set to true will be doubled each retry
     * @param {Boolean} exponential - Flag for exponential back-off mode
     * @param page
     * @return {Promise<*>}
     */
    //@ts-ignore
    async retry(fn: any, retriesLeft = 5, interval = 1000, exponential = false, page?: Page): Promise<any> {
        try {
            const val = await fn()
            return val
        } catch (error) {
            if (retriesLeft) {
                logger.warn('[retry].... retrying left (' + retriesLeft + ')')
                logger.warn('[retry] retrying err', error)
                if (page) {
                    const browserPage = await page?.evaluate(() => location.href)
                    logger.warn('[retry] retrying err on url', browserPage)
                    await fs.ensureDir(path.resolve(process.cwd(), 'errors'))
                    await page?.screenshot({
                        path: path.resolve(process.cwd(), `errors/${new Date().toISOString()}.png`),
                        fullPage: true
                    });
                }
                await new Promise<void>((r: any) => setTimeout(r, interval))
                return this.retry(fn, retriesLeft - 1, exponential ? interval * 2 : interval, exponential, page)
            } else {
                logger.error('[retry] Max retries reached')
                throw error
                //throw new Error('Max retries reached');
            }
        }
    }
}

