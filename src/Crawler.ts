
import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import * as sanitize from 'sanitize-filename';
import * as path from 'path';
// import json2md from 'json2md';
// import pRace from 'p-race';

import downOverYoutubeDL from './helpers/downOverYoutubeDL.js';

import imgs2pdf from './helpers/imgs2pdf.js';
import logger from './helpers/logger.js';
import scraper from "./helpers/scraper.js";
// import findChrome from 'chrome-finder'
import {orderBy} from "lodash-es";
import {NodeHtmlMarkdown} from 'node-html-markdown'
import series from './helpers/search.cjs';
// console.log('seeeee', series);
// import * as courses from '../json/search-courses.json' assert { type: "json" };;
// import type { MyData } from '../json/search-courses.json';
// import _courses from '../json/search-courses.json'  assert { type: "json" };
// const courses = _courses as Course[];
// const user = courses[0];
// console.log('user:', user)

import ora from 'ora';
let spinner;

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

import request from 'requestretry';
// const req = require('requestretry')
// const j = req.jar()
// const request = req.defaults({
//     jar         : j,
//     retryDelay  : 500,
//     fullResponse: true
// })
// import downloader from "./helpers/downloadChapters.js";
import PuppeteerHelper from "./helpers/PuppeteerHelper.js";
import {Page} from "puppeteer";
// import PuppeteerHelper from "./helpers/PuppeteerClusterHelper.js";
// const puppeteerHelper = new PuppeteerHelper();
let puppeteerHelper;
export default class Crawler {
    static async searchCourses(searchFromLocalFile) {
        if (searchFromLocalFile && await fs.exists(path.resolve(process.cwd(), 'json/search-courses.json'))) {
            logger.info('LOAD FROM LOCAL SEARCH FILE');
            const courses = series;//require(path.resolve(process.cwd(), 'json/search-courses.json'))
            return courses.map(c => ({
                ...c,
                value: c.url,
            }))
        }
        // return 'No courses found :('
        const lessons = await Promise
            .resolve()
            .then(async () => {

                const { body } = await request(`https://fireship.io/courses`)
                // console.log('body', body);
                const $ = cheerio.load(body)

                return $('ul.grid-list li a')
                    .map((i, elem) => {
                        // console.log('--', $(elem).find('h5').text().trim())
                        // console.log($(elem).attr('href'));
                        return {
                            title: $(elem).find('h5').text().trim(),
                            value: `https://fireship.io${$(elem).attr('href')}`,
                            url  : `https://fireship.io${$(elem).attr('href')}`
                        }
                    })
                    .get();
            })
            .then(c => c.flat())
        await fs.ensureDir(path.resolve(process.cwd(), 'json'))
        await fs.writeFile(path.resolve(process.cwd(), 'json/search-courses.json'), JSON.stringify(lessons, null, 2), 'utf8')
        return lessons;
    }

    delay(time) {
        return new Promise(function (resolve) {
            setTimeout(resolve, time)
        })
    }

    /**
     *
     * @param page
     * @param link
     * @param url
     * @returns {Promise<*>}
     */
    async getCoursesForDownload(page, link, { all }) {
        logger.info('--------', link, '-----');
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

        return all ? series : ([series.find(({ url }) => link.includes(url)) ?? link])
        /*const link = links.find(link => url.includes(link.txt))
        if (!link) {
            throw 'No link of school found!!!'
        }
        */
    }

    async getLessons(browser, page, course, opts) {
        logger.debug('entering getLessons method with course:', course);
        /*{
            "title": "React Supabase Full Course",
            "value": "https://fireship.io/courses/supabase/",
            "url": "https://fireship.io/courses/supabase/"
        }*/
        // console.log('getting lessons for course:', course);
        // ms.update('info', { text: `Checking ${course.url} for ${lessons.flat().length} lessons` })
        await page.goto(`${course.url}`, { waitUntil: 'networkidle0' }) // wait until page load

        // await this.makeScreenshot(browser, page, { title: course.title, topic: course.topic }, -1, course.title, opts)
        const [lessons, ,] = await Promise.all([
            (async () => {
                try {

                    await page.waitForSelector('.grid-list a', { timeout: 13e3 })
                    let lessons = await page.evaluate(() => {
                        const series = Array.from(document.body.querySelectorAll('header > h1'), txt => txt.textContent)[0]
                        const links = Array.from(document.body.querySelectorAll(".grid-list a"), (a, i) => {
                            return ({
                                url  : a.href,
                                title: a.querySelector('h5').innerText
                                    .replace(/\\W+/g, '')
                                    .replace(/(\r\n|\n|\r)/gm, '')
                                    .replace(/[/\\?%*:|"<>]/g, '')
                                    .trim(),
                                series,
                                downPath: series,
                                position: ++i
                            })
                        })
                        return links
                    })
                    logger.info('getLessons method lessons:', lessons.length);//lessons,
                    return lessons;
                } catch (e) {
                    logger.error('error with getLessons method lessons', e)
                    return false;
                }
            })(),
            this.makeScreenshot(browser, page, 0, course, opts),
            (async () => {
                //download videos
                // const prefix = all ? 'all-courses' : 'single-course'
                // const filename = `${prefix}-${new Date().toISOString()}.json`
                // await this.d(filename, prefix, items, { ...opts });
                try {
                    // const elementExists = await page.$('.b-status-control') !== null
                    // logger.debug(`if 2FA active: ${elementExists}`)
                    // if (elementExists) {

                    await page.waitForSelector('video-player', {
                        timeout: 10e3
                    })
                    logger.info('found iframe on a page')
                    // console.log('ima iframe:', lesson.url);
                    // Does exist
                } catch {
                    logger.error('error with video-player on course page:', e)
                    return;
                }

                const vimeoUrl = await this.extractVimeoFromIframe(page, course.url);
                const chapters = [
                    {
                        series  : course.title,
                        title   : `00-${course.title}.mp4`,
                        position: 0,
                        downPath: course.title,
                        vimeoUrl
                    }
                ]
                logger.debug('getLessons chapters:', chapters)
                // await downloader({chapters, mpb, ...opts })
                await this.d({ courses: chapters, ...opts });
            })(),
        ])
        // if (!lessons.length) {
        //     console.log('no lessons!!!');
        // }
        logger.debug('ending getLessons method with lessons length:', lessons.length);
        return lessons

    }

    /**
     *
     * @param opts
     * @param url
     * @returns {Promise<*>}
     */
    async scrapeCourses(opts, url) {
        puppeteerHelper = new PuppeteerHelper(opts)
        const { source, dir, concurrency, overwrite } = opts
        // ms.add('info', { text: `Get course: ${url}` })
        spinner = ora(`Get course: ${url}`).start()

        return await puppeteerHelper.withBrowser(async (browser) => {
            return await puppeteerHelper.withPage(browser)(async (page) => {
                // return await this.downloadLessons(page, url, opts, browser, concurrency, dir);
                logger.log('downloading source:', source)
                return source === 'courses'
                    ? await this.downloadCourses(page, url, opts, browser, concurrency, dir)
                    : await this.downloadLessons(page, url, opts, browser, concurrency, dir);
            })
        },  opts)
    }

    async downloadLessons(page, url, opts, browser, concurrency, dir) {
        await page.goto(`https://fireship.io/lessons/`, { waitUntil: 'networkidle0' }) // wait until page load

        let isBtnDisabled = false;
        let lessons = [];

        while (!isBtnDisabled) {
            await page.waitForSelector('ul.grid-list.justify-items-center.pl-0 > li:nth-child(1) > article', { timeout: 13e3 })

            const result = await page.$$eval('ul.grid-list.justify-items-center.pl-0 li', (lis) => lis.map((li) => {
                const title = li.querySelector('a h5').innerText;
                return ({
                    title,
                    value: `${li.querySelector('a').href}`,
                    url  : `${li.querySelector('a').href}`,
                    course: `Lessons/${title}`,
                    series: title,
                    // position: '',
                    downPath: `Lessons/${title}`
                })
            }))
            lessons.push(result)
            // console.log('result:', lessons)
            logger.debug('length:', lessons.length)
            await page.waitForSelector("ul.pagination.pagination-default li a[aria-label=\"Next\"]", { visible: true });
            const is_disabled = (await page.$("ul.pagination.pagination-default li a[aria-label=\"Next\"][aria-disabled]")) !== null;
            logger.debug('is_disabled', is_disabled);
            isBtnDisabled = is_disabled;
            if (!is_disabled) {
                logger.debug('clickkkkk');
                await Promise.all([
                    page.click("ul.pagination.pagination-default li a[aria-label=\"Next\"]"),
                    page.waitForNavigation({ waitUntil: "networkidle2" }),
                ]);
            }
            await this.delay(1e3)
        }
        /*lessons = [
            {
                title : 'Upload Multiple Files to Firebase Storage with Angular',
                value : 'https://fireship.io/lessons/angular-firebase-storage-uploads-multi/',
                url   : 'https://fireship.io/lessons/angular-firebase-storage-uploads-multi/',
                series: 'Upload Multiple Files to Firebase Storage with Angular',
                // position: '',
                // downPath: 'lUpload Multiple Files to Firebase Storage with Angular'
            }
        ]*/
        // lessons = [
        //     {
        //         title: 'Web Development Setup Guide for Windows with Linux (WSL)',
        //         value: 'https://fireship.io/lessons/windows-10-for-web-dev/',
        //         url: 'https://fireship.io/lessons/windows-10-for-web-dev/',
        //         course: 'Web Development Setup Guide for Windows with Linux (WSL)',
        //         series: 'Web Development Setup Guide for Windows with Linux (WSL)',
        //         downPath: `Lessons/Web Development Setup Guide for Windows with Linux (WSL)`
        //     }
        // ]
        const l =  await Promise
            .resolve()
            .then(async () => await this.extractLessonsData(lessons.flat(), browser, opts, concurrency))
            .then(c => c.flat()
                .filter(Boolean)
                .filter(item => item?.vimeoUrl)
            )
            .then(async items => {
                logger.debug('items', items);
                // ms.update('info', { text: `----lessons>>> ${items[0].series} has ${items.length} lessons for download` })
                // spinner.text = `----lessons>>> ${items[0].series} has ${items.length} lessons for download`;
                await Promise.all([
                    (async () => {
                        //check what is scraped from pages
                        await fs.ensureDir(path.resolve(process.cwd(), 'json'))
                        await fs.writeFile(path.resolve(process.cwd(), `json/lesson-${new Date().toISOString()}.json`), JSON.stringify(items, null, 2), 'utf8')
                    })(),
                    (async () => {
                        //download videos
                        // const prefix = all ? 'all-courses' : 'single-course'
                        // const filename = `${prefix}-${new Date().toISOString()}.json`
                        // await this.d(filename, prefix, items, { ...opts });
                        await this.d({ courses: items, ...opts });
                        logger.debug('DONE download!!!');
                    })(),
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
        await fs.writeFile(path.resolve(process.cwd(), 'json/test-lessons.json'), JSON.stringify(lessons, null, 2), 'utf8')

        return lessons
    }

    async downloadCourses(page: Page, url: string, opts, browser, concurrency, dir) {
        // await this.loginAndRedirect(page, opts)
        const courses = await this.getCoursesForDownload(page, url, opts)
        logger.debug('Number of courses to be downloaded:', courses.length);//, courses

        if (!courses?.length) {
            logger.debug('No courses found, check if it is already downloaded!!!!');
            return [];
        }

        const lessons = await Promise
            .mapSeries(courses, async (course) => {
                course.course = course.title
                course.series = course.title
                const lessons = await this.getLessons(browser, page, course, opts);
                logger.debug(`Found: ${lessons.length} lessons for course: ${course.url}`);

                if (!lessons?.length) {
                    logger.debug(`No lessons found for url: ${course.url}!!!!`);
                    return [];
                }

                const chapters =  await this.extractLessonsData(lessons, browser, opts, concurrency);
                logger.info('chapters', chapters)

                return chapters
            })
            /*.then(async c => c.flat())
            .filter(Boolean)
            .filter(item => item?.vimeoUrl)*/
            .then(c => c.flat()
                .filter(Boolean)
                .filter(item => item?.vimeoUrl)
            )
            .then(async items => {
                logger.debug(`---- ${items.length} lessons for download`, items)
                // spinner.text = `---- ${items[0].series} has ${items.length} lessons for download`;
                // ms.update('info', { text: `---- ${items[0].series} has ${items.length} lessons for download` })
                await Promise.all([
                    (async () => {
                        //check what is scraped from pages
                        await fs.ensureDir(path.resolve(process.cwd(), 'json'))
                        await fs.writeFile(path.resolve(process.cwd(), `json/test-${new Date().toISOString()}.json`), JSON.stringify(items, null, 2), 'utf8')
                    })(),
                    /*(async () => {
                        //download videos
                        // const prefix = all ? 'all-courses' : 'single-course'
                        // const filename = `${prefix}-${new Date().toISOString()}.json`
                        // await this.d(filename, prefix, items, { ...opts });
                        await this.d({ courses: items, ...opts });
                    })(),*/
                    (async () => {
                        // await imgs2pdf(
                        //     path.join(opts.dir, course.title),
                        //     path.join(opts.dir, course.title, `${course.title}.pdf`))
                        logger.debug('saving images to pdf', path.join(dir, items[0].downPath, 'screenshots'));
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
        await fs.writeFile(path.resolve(process.cwd(), 'json/test.json'), JSON.stringify(lessons, null, 2), 'utf8')

        return lessons
    }

    async extractLessonsData(lessons, browser, opts, concurrency) {
        logger.debug('lessons length:', lessons.length);
        return await Promise
            .map(lessons, async (lesson, index) => {
                return await puppeteerHelper.withPage(browser)(async (page) => {
                    return await this.retry(async () => {
                        logger.debug(`scraping: ${index}/${lessons.length} - ${lesson.url} - ${lesson.title}`);
                        // ms.update('info', { text: `scraping: ${index} - ${lesson.url} - ${lesson.title}, Lesson: ${lesson.url} - ${lesson.title}` })
                        // spinner.text = `scraping: ${index} - ${lesson.url} - ${lesson.title}, Lesson: ${lesson.url} - ${lesson.title}`;
                        await page.goto(lesson.url, { waitUntil: 'networkidle0' })
                        await this.applyHackAndExtractInfo(page);

                        let vimeoUrl;
                        try {
                            /*// Select the shadow root element
                            const shadowRoot = await page.$('video-player').shadowRoot();

                            // Wait for the iframe element inside the shadow DOM
                            await shadowRoot.waitForSelector('iframe');*/
                            // await page.waitForSelector('iframe', {//video-player
                            //     timeout: 30e3
                            // })

                            let iframeSrc = await page.evaluate(() => Array.from(document.body.querySelectorAll('video-player'), elem => elem?.shadowRoot?.querySelector("iframe").src)[0])
                            logger.info('------------------------------------------------iframeSrc:', iframeSrc)
                            // Does exist
                            vimeoUrl = await this.extractVimeoFromIframe(page, lesson.url);
                            logger.debug('ima iframe:', vimeoUrl, lesson.url);
                        } catch (err) {
                            logger.error('nema iframe:', lesson.url, err);
                            return;
                        }

                        // await this.delay(2e3)
                        // await this.makeScreenshot(browser, page, lesson.position, lesson, opts)
                        // logger.info('vimeoUrl: ', vimeoUrl)

                        const l = this.extractVideos({
                            course: {
                                index,
                                vimeoUrl,
                                ...lesson,
                            },
                            index,
                            total : lessons.length
                        })

                        await Promise.all([
                            (async () => {
                                logger.debug('making screenshots');
                                await this.delay(1e3)
                                await this.makeScreenshot(browser, page, lesson.position, lesson, opts)
                                logger.info('vimeoUrl: ', vimeoUrl)
                            })(),
                            (async () => {
                                logger.debug('start download');
                                const chapters = [l]
                                // await downloader({chapters, mpb, ...opts })
                                await this.d({ courses: chapters, ...opts });
                            })(),
                        ])

                        // const prefix = all ? 'all-lessons' : 'single-course'
                        // const filename = `${prefix}-${new Date().toISOString().replace(/:/g, "-")}.json`
                        //await this.d({ courses: [l], ...opts });
                        //c++;
                        return l;
                    })

                }, 6, 1e3, true);
            }, { concurrency: 5 })
    }

    async applyHackAndExtractInfo(page) {
        await this.delay(1e3)
        await page.evaluate(() => {
            //setInterval(() => {
            document.querySelectorAll("[free=\"\"]").forEach(el => el.setAttribute("free", true)) // set all elements with the attribute free set to "" to true

            if (document.querySelector("if-access [slot=\"granted\"]")) { // replace HOW TO ENROLL to YOU HAVE ACCESS
                document.querySelector("if-access [slot=\"denied\"]").remove()
                document.querySelector("if-access [slot=\"granted\"]").setAttribute("slot", "denied")
            }

            if (document.querySelector("video-player")?.shadowRoot?.querySelector(".vid")?.innerHTML) return; // return if no video player
            const vimeoId = document.querySelector("global-data").vimeo; // get id for vimeo video
            const youtubeId = document.querySelector("global-data").youtube; // get id for vimeo video

            if (vimeoId && document.querySelector("video-player")) { // if there is an id,
                document.querySelector("video-player")?.setAttribute("free", true) // set free to true
                document.querySelector("video-player").shadowRoot.querySelector(".vid").innerHTML = `<iframe src="https://player.vimeo.com/video/${vimeoId}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen="" title="${location.pathname.split("/")[3]}" width="426" height="240" frameborder="0"></iframe>` // set video
            }
            if (youtubeId && document.querySelector("video-player")) { // if there is an id,
                document.querySelector("video-player")?.setAttribute("free", true) // set free to true
                document.querySelector("video-player").shadowRoot.querySelector(".vid").innerHTML = `<iframe src="https://youtube.com/embed/${youtubeId}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen="" title="${location.pathname.split("/")[3]}" width="426" height="240" frameborder="0"></iframe>` // set video
            }
            //}, 100)
            return 1;
        })
    }

    async extractVimeoFromIframe(page, sourceUrl) {
        logger.debug('sourceUrl:',sourceUrl)
        const vimeoUrl = await this.retry(async () => {
            //wait for an iframe
            await page.waitForSelector(`pierce/iframe`, {
                // waitUntil: 'networkidle0',x
                timeout  : 33e3
            })

            // let iframeSrc = await page.evaluate(() => Array.from(document.body.querySelectorAll('video-player'), elem => elem?.shadowRoot?.querySelector("iframe").src)[0])

            const { vimeoId, youtubeId } = await page.evaluate(() => {
                const vimeoId = document.querySelector("global-data").vimeo; // get id for vimeo video
                const youtubeId = document.querySelector("global-data").youtube;
                return {
                    vimeoId,
                    youtubeId
                }
            })
            if (!vimeoId && !youtubeId) {
                throw new Error(`No vimeo or youtube id found for lesson:${sourceUrl}`)
            }
            // await this.delay(20e3) //5e3
            logger.info('>>>>iframeSrc', { vimeoId, youtubeId });
            if (youtubeId) {//iframeSrc.includes('www.youtube.com')
                logger.info('-----we have youtube link', youtubeId);
                return `https://youtu.be/${youtubeId}`
            }
            //https://player.vimeo.com/video/823089634?h=bb2ed67fbb&app_id=122963
            const src = (await fetch(`https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F${vimeoId}&id=${vimeoId}`).then(r => r.json())).html.split("src=\"")[1].split("\"")[0];
            logger.info('VIMEO LINK:', src)
            const selectedVideo = await this.vimeoRequest(src, sourceUrl)//`https://player.vimeo.com/video/${vimeoId}` //?h=bb2ed67fbb&app_id=122963
            return selectedVideo.url;
        }, 6, 1e3, true);
        return vimeoUrl;
    }

    /**
     *
     * @param browser
     * @param page
     * @param position
     * @param lesson
     * @param opts
     * @returns {Promise<void>}
     */
    async makeScreenshot(browser, page, position, lesson, opts) {
        logger.info('make screenshot lesson:', lesson)
        // {
        //     title: 'Next.js - The Full Course',
        //     value: 'https://fireship.io/courses/nextjs/',
        //     url: 'https://fireship.io/courses/nextjs/',
        //     course: 'Next.js - The Full Course'
        // }
        //create a screenshot
        const $sec = await page.$('body')
        if (!$sec) throw new Error(`Parsing failed!`)
        await this.delay(1e3) //5e3

        const title = sanitize(lesson.title)
        let series = sanitize(lesson.series) //sanitize(course.title)

        const dest = path.join(opts.dir, series) //, lesson.downPath
        fs.ensureDir(path.join(dest, 'screenshots'));
        await $sec.screenshot({
            path          : path.join(dest, 'screenshots', `${String(position).padStart(2, '0')}-${title}.png`),
            type          : 'png',
            // omitBackground: true,
            // delay         : '500ms'
        })

        await this.delay(1e3)

        // await this.createFullPageScreenshot(page, dest, position, title);
        await this.delay(1e3)
        const directory = path.join(dest, 'html', sanitize(`${String( position).padStart(2, '0')}-${title}`))
        logger.info('directory::::', directory);
        await scraper(opts, page, directory, lesson)
        await this.delay(1e3)

        // await this.createHtmlPage(page, dest, position, title);
        await this.createMarkdownFromHtml(page, dest, lesson, position, title);
        await this.createPdf(browser, page, dest, position, title);
    }

    /**
     *
     * @param opts
     * @returns {Promise<void>}
     */
    async d(opts) {
        const {
                  courses,
                  logger,
                  concurrency,
                  file,
                  filePath
              } = opts

        let cnt = 0
        //logger.info(`Starting download with concurrency: ${concurrency} ...`)
        await Promise.map(courses, async (course, index) => {
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
            logger.info('before download course:', course)
            const dest = path.join(opts.dir, course.downPath)
            fs.ensureDir(dest)

            const details = await this.getSizeOfVideo(course)
            await downOverYoutubeDL(details, path.join(dest, course.title), {
                ...opts,
                downFolder: dest,
                index
            })

            if (file) {
                courses[index].done = true
                await fs.writeFile(filePath, JSON.stringify(courses, null, 2), 'utf8')
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
     * @param logger
     * @param prefix
     * @param courses
     * @param filename
     * @returns {Promise<void>}
     */
    async writeVideosIntoFile(file, prefix, courses, filename) {
        if (!file) {
            await fs.writeFile(path.join(process.cwd(), `json/${filename}`), JSON.stringify(courses, null, 2), 'utf8')
            // logger.info(`json file created with lessons ...`)
            // spinner.text = 'json file created with lessons ...';
        }
        // logger.succeed(`Downloaded all videos for '${prefix}' api! (total: ${courses.length})`)
        console.log(`Downloaded all videos for '${prefix}' api! (total: ${courses.length})`);
        // spinner.succeed(`Downloaded all videos for '${prefix}' api! (total: ${courses.length})`)
        //return courses
    }

    /**
     *
     * @param url
     * @param sourceUrl
     * @returns {Promise<{size: string | undefined, url: *}>}
     */
    async vimeoRequest(url, sourceUrl) {
        try {
            const { body, attempts } = await request({
                url,
                maxAttempts: 50,
                headers    : {
                    'Referer'   : "https://fireship.io/",
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36'
                }
            })

            const v = this.findVideoUrl(body, url, sourceUrl)
            if (!v) {
                return {
                    size: -1,
                    url : url
                }
            }

            logger.debug('attempts', attempts);
            const { headers, attempts: a } = await request({
                url         : v,
                json        : true,
                maxAttempts : 50,
                method      : "HEAD",
                fullResponse: true, // (default) To resolve the promise with the full response or just the body
                headers     : {
                    'Referer': "https://fireship.io/"
                }
            })

            return {
                url : v,//url
                size: headers['content-length']
            };
        } catch (err) {
            logger.error('ERR::', err);
            logger.error('err url:', url);
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
    findVideoUrl(str, url, sourceUrl) {
        const regex = /(?:playerConfig = )(?:\{)(.*(\n.*?)*)(?:"\})(;)/gm;
        let res = regex.exec(str);
        let config;
        if (res !== null) {
            if (typeof res[0] !== "undefined") {
                try {
                    config = res[0].replace('playerConfig = ', '');
                    config = config.replace(/(;\s*$)/g, '');
                    const configParsed = JSON.parse(config);
                    let progressive = configParsed.request.files.progressive;
                    if (!progressive.length) {
                        logger.error('Noooooooooooooooooooooooooooooooooooooooooooooooo', url, sourceUrl);
                        return null;
                    }
                    let video = orderBy(progressive, ['width'], ['desc'])[0];
                    return video.url;
                } catch (err) {
                    logger.debug('error with findVideoUrl:', err);
                    logger.debug('json config:', config);
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
    async isHeadlessMode(browser) {
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
    async createPdf(browser, page, dest, position, title) {
        logger.debug('entering createPdf')
        /*if (!await this.isHeadlessMode(browser)) {
            console.log('headless mode is set off!!!')
            return
        }*/
        await this.retry(async () => {
            await fs.ensureDir(path.join(dest, 'pdf'))
            await page.pdf({
                path           : path.join(dest, 'pdf', sanitize(`${String(position).padStart(2, '0')}-${title}.pdf`)),
                printBackground: true,
                format         : "Letter",
                timeout        : 92e3,
            });
            logger.debug('ending createPdf')
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
    async createHtmlPage(page, dest, position, title) {
        await fs.ensureDir(path.join(dest, 'html'))
        //save html of a page
        const html = await page.content();
        await fs.writeFile(path.join(dest, 'html', sanitize(`${String(position).padStart(2, '0')}-${title}.html`)), html);
        await this.delay(1e3)
    }

    /**
     *
     * @param page
     * @param dest
     * @param position
     * @param title
     * @returns {Promise<void>}
     */
    async createFullPageScreenshot(page, dest, position, title) {
        await fs.ensureDir(dest)
        await page.screenshot({
            path    : path.join(dest, sanitize(`${String(position).padStart(2, '0')}-${title}-full.png`)),
            fullPage: true
        });
    }

    /**
     *
     * @param page
     * @param dest
     * @param lesson
     * @param index
     * @param title
     * @returns {Promise<void>}
     */
    async createMarkdownFromHtml(page, dest, lesson, index, title) {
        logger.debug('entering createMarkdownFromHtml')
        const nhm = new NodeHtmlMarkdown();
        let position = index + 1
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
        // console.log('markdown', markdown);

        if (!markdown) {
            logger.error('-----------------nema markdown', title);
            await this.createFullPageScreenshot(page, path.join(dest, sanitize(lesson.course), 'error'), 0, title);
            // throw new Error(`No Markdown found - ${title}`)
            return;
        }
        await fs.ensureDir(path.join(dest, 'markdown'))
        await fs.writeFile(path.join(dest, 'markdown', sanitize(`${String(position).padStart(2, '0')}-${title}.md`)), nhm.translate(markdown), 'utf8')
        await this.delay(1e3)
        logger.debug('ending createMarkdownFromHtml')
    }

    /**
     *
     * @param course
     * @param ms
     * @param index
     * @param total
     * @returns {bluebird<{series: string, downPath: string, position: number | string, title: string, url: string}>}
     */
    extractVideos({
        course,
        index,
        total
    }) {
        let series = sanitize(course.series)
        let position = course.index + 1
        let title = sanitize(`${String(position).padStart(2, '0')}-${course.title}.mp4`)
        // let downPath = `${course.series.id}-${series}`
        let downPath = course.downPath
        // ms.update('info', { text: `Extracting: ${index}/${total} series ${series} - episode ${title}` });

        return {
            series,
            title,
            position,
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
    async getSizeOfVideo(course) {
        const vimeoUrl = course.vimeoUrl

        try {
            const {
                      headers,
                      attempts: a
                  } = await request({
                url         : vimeoUrl, //v,
                json        : true,
                maxAttempts : 50,
                method      : 'HEAD',
                fullResponse: true, // (default) To resolve the promise with the full response or just the body
            })

            return {
                url : vimeoUrl, //v
                size: headers['content-length']
            }
        } catch (err) {
            logger.error('getSizeOfVideo ERR::', err)
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
    async retry(fn, retriesLeft = 5, interval = 1000, exponential = false, page = false) {
        try {
            const val = await fn()
            return val
        } catch (error) {
            if (retriesLeft) {
                logger.warn('.... retrying left (' + retriesLeft + ')')
                logger.warn('retrying err', error)
                if (page) {
                    const browserPage = await page.evaluate(() => location.href)
                    logger.warn('----retrying err on url', browserPage)
                    await fs.ensureDir(path.resolve(process.cwd(), 'errors'))
                    await page.screenshot({
                        path: path.resolve(process.cwd(), `errors/${new Date().toISOString()}.png`),
                        // path    : path.join(process., sanitize(`${String(position).padStart(2, '0')}-${title}-full.png`)),
                        fullPage: true
                    });
                }
                await new Promise(r => setTimeout(r, interval))
                return this.retry(fn, retriesLeft - 1, exponential ? interval*2 : interval, exponential, page)
            } else {
                logger.error('Max retries reached')
                throw error
                //throw new Error('Max retries reached');
            }
        }
    }
}

