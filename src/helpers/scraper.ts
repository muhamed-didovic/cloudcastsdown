import * as path from 'path';
import sanitize from 'sanitize-filename';
import fs from 'fs-extra';
// @ts-ignore
// import scrape from 'website-scraper';
import scrape from '../website-scraper/index.js';
// @ts-ignore
import SaveToExistingDirectoryPlugin from 'website-scraper-existing-directory';
// import { parentPort } from "worker_threads";
import logger from "./logger.js";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { delay, getPosition, hasValues, scrollToBottom } from "./helper.js";
import { Page } from 'puppeteer';
import { Lesson, ScrapeOpts } from '../types.js';
import downOverYoutubeDL from "./downOverYoutubeDL.js";

import Bluebird from "bluebird";
global.Promise = Bluebird;

//import logger from "./logger.js";

const createPdf = async (page: Page, dest: string, position: string | number, title: string) => {
    logger.debug(`[pdf] entering createPdf [source]: ${ title }`)
    /*if (!await this.isHeadlessMode(browser)) {
        console.log('headless mode is set off!!!')
        return
    }*/
    // await retry(async () => {
    await fs.ensureDir(path.join(dest, 'pdf'))
    await page.pdf({
        path: path.join(dest, 'pdf', sanitize(`${ getPosition(position) }${ title }.pdf`)),
        printBackground: true,
        format: "Letter",
        timeout: 91e3,
    });
    logger.debug(`[pdf] ending createPdf [source]: ${ title }`)
    // }, 6, 1e3, true, page);
}

const createFullPageScreenshot = async(page: Page, dest: string, position: number, title: any) => {
    logger.debug(`[createFullPageScreenshot]  entering createFullPageScreenshot [source]: ${title}`)
    await fs.ensureDir(dest)
    await page.screenshot({
        path: path.join(dest, sanitize(`${getPosition(position)}${title}.png`)),//-full.png
        fullPage: true
    });
}

const createMarkdown = async (dest: string, lesson: Lesson, position: number | string, title: string, markdown: any) => {
    logger.debug(`[createMarkdown] entering [source]: ${lesson.series}`)
    const nhm = new NodeHtmlMarkdown();

    await fs.ensureDir(path.join(dest, 'markdown'))
    fs.writeFile(path.join(dest, 'markdown', sanitize(`${getPosition(position)}${title}.md`)), nhm.translate(markdown), 'utf8')
    await delay(1e3)
    logger.debug(`[createMarkdown] ending [source]: ${lesson.course}`)
}
const createMarkdownFromHtml = async (page: Page, dest: string, lesson: Lesson, position: string | number, title: string) => {
    logger.debug(`[markdown] entering createMarkdownFromHtml scraper [source]: ${ lesson.url }`)
    const nhm = new NodeHtmlMarkdown();
    //let position = index + 1
    const markdown = await Promise.race([
        (async () => {
            // check is lesson page
            try {
                await page.waitForSelector('.markdown')
                let markdown = await page.evaluate(() => Array.from(document.body.querySelectorAll(".markdown"), txt => txt.outerHTML)[0]);
                return markdown;
            } catch (e) {
                return false;
            }

        })(),
        (async () => {
            // check is home page of course
            //
            try {
                await page.waitForSelector('#app > div > div.min-h-screen > main > div.max-w-7xl.mx-auto.py-12 > div > div')
                let markdown = await page.evaluate(() => Array.from(document.body.querySelectorAll("#app > div > div.min-h-screen > main > div.max-w-7xl.mx-auto.py-12 > div > div"), txt => txt.outerHTML)[0]);
                return markdown;
            } catch (e) {
                return false;
            }

        })(),
    ])

    if (!markdown) {
        logger.error('[markdown]  -----------------nema markdown [source]: ${lesson.course}', title);
        await createFullPageScreenshot(page, path.join(process.cwd(), 'error'), 0, `${title}-no-markdown`);
        // throw new Error(`No Markdown found - ${title}`)
        return;
    }
    await fs.ensureDir(path.join(dest, 'markdown'))
    await fs.writeFile(path.join(dest, 'markdown', sanitize(`${ getPosition(position) }${ title }.md`)), nhm.translate(markdown), 'utf8')
    await delay(1e3)
    logger.debug(`[markdown] ending createMarkdownFromHtml scraper [source]: ${lesson.url}`)
}

const blockNavigation = async (page: Page, url: string) => {
    logger.info(`block navigation for puppeteer page from url ${url}`);

    page.on('request', req => {
        // logger.debug('[scraper] req.url() !== url', req.url(), url);
        if (req.isNavigationRequest() && req.frame() === page.mainFrame() && req.url() !== url) {
            req.abort('aborted');
        } else {
            req.continue();
        }
    });
    await page.setRequestInterception(true);
};
let scrapedUrl = '';
class PuppeteerPlugin {
    opts: ScrapeOpts;
    scrollToBottom: { timeout: number; viewportN: number } | null;
    blockNavigation: boolean;
    page: Page;
    lesson: Lesson;
    headers: {};
    directory: string;
    position: string | number | any;
    dest: string;
    constructor({
        opts = {} as ScrapeOpts,
        scrollToBottom = { timeout: 10000, viewportN: 10 },
        blockNavigation = false,
        page = {} as Page,
        lesson = {} as Lesson,
        directory = '',
        position = ''
    }) {
        this.opts = opts;
        this.scrollToBottom = scrollToBottom;
        this.blockNavigation = blockNavigation;
        this.headers = {};
        this.lesson = lesson;
        this.page = page;
        this.directory = directory;
        this.position = position;

        // logger.info('init plugin', { launchOptions, scrollToBottom, blockNavigation });

        // let position = index + 1;
        this.dest = path.join(this.directory, 'media');
    }

    apply(registerAction: Function) {
        registerAction('beforeRequest', async ({requestOptions}: {requestOptions: any}) => {
            if (hasValues(requestOptions.headers)) {
                this.headers = Object.assign({}, requestOptions.headers);
            }
            return {requestOptions};
        });

        registerAction('afterResponse', async ({ response }: any) => {
            // console.log('222', response);

            const contentType = response.headers.get('content-type');
            const isHtml = contentType && contentType.split(';')[0] === 'text/html';
            logger.debug(`[scraper] ---------------------- afterResponse hook ---- [source]: ${ response.url } content-type: ${ contentType } isHtml: ${ isHtml }`)
            if (isHtml) {
                logger.info(`[scraper] entering PuppeteerPlugin [source]: ${ this.lesson.url }`)
                // const url = response.url;
                const opts = this.opts
                const page = this.page
                // const course = this.lesson
                //const page = await this.browser.newPage();


                if (hasValues(this.headers)) {
                    // logger.info('set headers to puppeteer page', this.headers);
                    await page?.setExtraHTTPHeaders(this.headers);
                }

                // if (this.blockNavigation && page) {
                //     await blockNavigation(page, response.url);
                // }


                //await page.goto(url);
                // const ls = await page.evaluate(() =>  Object.assign({}, window.localStorage));
                // console.log('poslije loada storage:', ls);

                const iFrame = await page.$('iframe[src*="player.vimeo"]') !== null
                if (iFrame) {
                    logger.log('[scraper] iFrame:', iFrame);
                    const srcs = await page.evaluate(async () => {
                        //find all iframe with vimeo links, download video and replace them
                        const iFrame = document.querySelectorAll('iframe[src*="player.vimeo"]');
                        let srcs = []
                        iFrame.forEach((item, index) => {
                            let src = item.src;

                            // const newItem = document.createElement("video");
                            // // newItem.style = "width:640px; height:360px";
                            // // modify directly link to vimeo video from local media folder
                            // // newItem.src = src
                            // newItem.src = `media/${src.split('/').pop().split('?')[0]}.mp4`;
                            // item.parentNode.replaceChild(newItem, iFrame[index]);
                            // newItem.setAttribute("class", "iframe-video-tag-" + index);
                            // newItem.setAttribute("controls", "true");
                            //let videoTag = document.getElementsByClassName("iframe-video-tag-" + index);
                            // videoTag.src = src;
                            //modify directly link to vimeo video from local media folder
                            //videoTag.src = `media/${src.split('/').pop()}.mp4`;
                            // return src
                            srcs.push(src)

                        });
                        return srcs;
                    });

                    logger.log('[scraper] srcs', srcs);
                    await Promise.map(srcs, async (url, index) => {
                            // console.log('url--------------------', url);
                            // const dest = path.join(opts.dir, course.downPath)
                            // fs.ensureDir(dest)
                            // const details = await getSizeOfVideo(course)
                            const details = {
                                size: -1,
                                url : url
                            }
                            await downOverYoutubeDL(details, path.join(this.dest, `${url.split('/').pop().split('?')[0]}.mp4`), {
                                ...opts,
                                downFolder: this.dest,
                                index
                            })

                        }
                        // ,{
                        //     concurrency//: 1
                        // }
                    )
                    await page.waitForTimeout(5e3)
                    await page.evaluate(async () => {
                        //find all iframe with vimeo links, download video and replace them
                        const iFrame = document.querySelectorAll('iframe[src*="player.vimeo"]');
                        // let srcs = []
                        iFrame.forEach((item, index) => {
                            let src = item.src;

                            const newItem = document.createElement("video");
                            newItem.src = `media/${src.split('/').pop().split('?')[0]}.mp4`;
                            item.parentNode.replaceChild(newItem, iFrame[index]);
                            newItem.setAttribute("class", "iframe-video-tag-" + index);
                            newItem.setAttribute("controls", "true");
                            // Add CSS styles to the element
                            newItem.style.position = 'absolute';
                            newItem.style.top = '0';
                            newItem.style.left = '0';

                        });
                        // return srcs;
                    });
                }
                /*if (iFrame) {
                    logger.log('iFrame', iFrame);
                    const srcs = await page.evaluate(async () => {
                        //find all iframe with vimeo links, download video and replace them
                        const iFrame = document.querySelectorAll('iframe[src*="player.vimeo"]');
                        let srcs = []
                        iFrame.forEach((item, index) => {
                            let src = item.src;

                            const newItem = document.createElement("video");
                            newItem.style = "width:640px; height:360px";
                            // modify directly link to vimeo video from local media folder
                            // newItem.src = src
                            newItem.src = `media/${src.split('/').pop().split('?')[0]}.mp4`;
                            item.parentNode.replaceChild(newItem, iFrame[index]);
                            newItem.setAttribute("class", "iframe-video-tag-" + index);
                            newItem.setAttribute("controls", "true");
                            //let videoTag = document.getElementsByClassName("iframe-video-tag-" + index);
                            // videoTag.src = src;
                            //modify directly link to vimeo video from local media folder
                            //videoTag.src = `media/${src.split('/').pop()}.mp4`;
                            // return src
                            srcs.push(src)

                        });
                        return srcs;
                    });

                    console.log('srcs', srcs);
                    await Promise.map(srcs, async (url, index) => {
                            // console.log('url--------------------', url);
                            // const dest = path.join(opts.dir, course.downPath)
                            // fs.ensureDir(dest)
                            // const details = await getSizeOfVideo(course)
                            const details = {
                                size: -1,
                                url : url
                            }
                            await downOverYoutubeDL(details, path.join(this.dest, `${url.split('/').pop().split('?')[0]}.mp4`), {
                                ...opts,
                                downFolder: this.dest,
                                index
                            })

                        }
                        // ,{
                        //     concurrency//: 1
                        // }
                    )
                }*/

                await delay(1e3)
                if (this.scrollToBottom) {
                    await scrollToBottom(page, this.scrollToBottom.timeout, this.scrollToBottom.viewportN);
                }
                await delay(1e3)

                // logger.info(`[scraper] Compare URLs: ${ this.lesson.url  } with scrapred url: ${ scrapedUrl }, RESULT: ${ scrapedUrl === this.lesson.url } with response url: ${ response.url }`)

                const dest = path.join(opts.dir, this.lesson.downPath);
                const [content,] = await Promise.all([
                    (async () => {
                        return await page.content();
                    })(),
                    (async () => {
                        logger.debug('scrapedUrl === this.lesson.url', scrapedUrl === this.lesson.url, scrapedUrl, this.lesson.url)
                        if (scrapedUrl === this.lesson.url) return;
                        await delay(2e3)
                        //await this.createFullPageScreenshot(page, path.join(dest, 'screenshots'), position, title);
                        logger.debug(`[scraper] createFullPageScreenshot [source]: ${ this.lesson.url } `)//with dest: ${ dest } with position: ${ this.position }
                        /*await fs.ensureDir(path.join(dest, 'screenshots'))
                        await page.screenshot({
                            path: path.join(dest, 'screenshots', sanitize(`${ String(this.position).padStart(2, '0') }-${ this.lesson.title }.png`)),//-full.png
                            fullPage: true,
                            type: 'png',
                            omitBackground: true,
                            delay: '1000ms'
                        });*/

                        const $sec = await page.$('body')
                        if (!$sec) throw new Error(`Parsing failed!`)
                        // await this.delay(1e3) //5e3
                        fs.ensureDir(path.join(dest, 'screenshots'));
                        await $sec.screenshot({
                            path: path.join(dest, 'screenshots', `${ getPosition(this.position) }${ this.lesson.slug }.png`),
                            type: 'png',
                            // omitBackground: true,
                            // timeout: '10e3'
                        })
                        await delay(2e3)
                    })(),
                    (async () => {
                        if (scrapedUrl === this.lesson.url) return;
                        await createMarkdownFromHtml(page, dest, this.lesson, this.position, this.lesson.slug)
                    })(),
                    // (async () => {
                    //     if (scrapedUrl === this.lesson.url) return;
                    //     await createPdf(page, dest, this.position, this.lesson.title)
                    // })(),
                ]);

                scrapedUrl = this.lesson.url;
                logger.debug(`[scraper] ending PuppeteerPlugin [source]: ${ this.lesson.url }`)
                // convert utf-8 -> binary string because website-scraper needs binary
                // return Buffer.from(content).toString('binary');

                // await page.waitForTimeout(10e3)
                return content;
            } else {
                // console.log('response.text()', await response.text());
                return Promise.resolve(response)//.text();

                // return Buffer.from(await response.text()).toString('binary')
                // return response.body;
                // return response.text();
            }
        });
    }
}

const scraper = async (opts: any, page: Page, directory: string, lesson: any, position: string) => {
    logger.debug(`[scraper] entering scraper [source]: ${ lesson.url }`)
    const urls = [lesson.url];
    await scrape({
        // urls     : [
        //     'https://students.learnjavascript.today/lessons/welcome/',
        //     'https://students.learnjavascript.today/lessons/animating-with-js/'
        // ],
        // directory: `./zzz-${new Date().toISOString()}`,
        urls,//: [url],
        directory,
        sources: [
            { selector: 'style' },
            { selector: '[style]', attr: 'style' },
            { selector: 'img', attr: 'src' },
            { selector: 'img', attr: 'srcset' },
            { selector: 'input', attr: 'src' },
            { selector: 'object', attr: 'data' },
            { selector: 'embed', attr: 'src' },
            { selector: 'param[name="movie"]', attr: 'value' },
            { selector: 'script', attr: 'src' },
            { selector: 'link[rel="stylesheet"]', attr: 'href' },
            { selector: 'link[rel*="icon"]', attr: 'href' },
            { selector: 'svg *[xlink\\:href]', attr: 'xlink:href' },
            { selector: 'svg *[href]', attr: 'href' },
            { selector: 'picture source', attr: 'srcset' },
            { selector: 'meta[property="og\\:image"]', attr: 'content' },
            { selector: 'meta[property="og\\:image\\:url"]', attr: 'content' },
            { selector: 'meta[property="og\\:image\\:secure_url"]', attr: 'content' },
            { selector: 'meta[property="og\\:audio"]', attr: 'content' },
            { selector: 'meta[property="og\\:audio\\:url"]', attr: 'content' },
            { selector: 'meta[property="og\\:audio\\:secure_url"]', attr: 'content' },
            { selector: 'meta[property="og\\:video"]', attr: 'content' },
            { selector: 'meta[property="og\\:video\\:url"]', attr: 'content' },
            { selector: 'meta[property="og\\:video\\:secure_url"]', attr: 'content' },
            { selector: 'video', attr: 'src' },
            { selector: 'video source', attr: 'src' },
            { selector: 'video track', attr: 'src' },
            { selector: 'audio', attr: 'src' },
            { selector: 'audio source', attr: 'src' },
            { selector: 'audio track', attr: 'src' },
            { selector: 'frame', attr: 'src' },
            { selector: 'iframe', attr: 'src' },
            { selector: '[background]', attr: 'background' },

            { selector: 'a.svelte-prt11s', attr: 'href' }, //get source of course on pages
            { selector: 'a[href*=".zip"]', attr: 'href' }, //get sources on /components page
        ],
        plugins: [
            new PuppeteerPlugin({
                opts,
                scrollToBottom: { timeout: 10000, viewportN: 10 }, /* optional */
                blockNavigation: true, /* optional */
                page,
                lesson,
                directory,
                position
            }),
            new SaveToExistingDirectoryPlugin(),
            // new MyPlugin(page)
        ],
        urlFilter: function (url: string) {
            // console.log('PARSING URL:', url, !url.includes('404'), !url.includes('player.vimeo.com'));
        //     //return !url.includes('404') || !url.includes('player.vimeo.com');
        //     // return !(url.includes('404') || url.includes('player.vimeo.com'));
        //     if (url.includes('404') || url.includes('player.vimeo.com') || url.includes('/media/')) {//
        //         return false
        //     }
        //     return true;

            if (url.includes('404')
                || url.includes('/img/img/')
                || url.includes('youtube.com')
                || url.includes('vimeo.com')
                || url.includes('player.vimeo.com')
                || url.includes('googletagmanager.com')
                || url.includes('google-analytics.com')
                || url.includes('beacon-v2.helpscout.net')
                || url.includes('accounts.google.com')
                || url.includes('googleads.g.doubleclick.net')
                || url.includes('sentry.io')
                || url.includes('static.ads-twitter.com')
                || url.includes('ads-twitter.com')
                || url.includes('connect.facebook.net')
                || url.includes('facebook.net')
                || url.includes('hsforms.com')
                || url.includes('hubspot.com')
                || url.includes('discord.com')
                || url.includes('facebook.com')

                || url.includes('app.js')
                || url.includes('/media/')
            ) {// url.includes('404') || url.includes('/media/')
                return false
            }
            return true;
        },
    });
    logger.debug(`[scraper] leaving scraper [source]: ${ lesson.url }`)
    return `Scraper is done!!! ${ lesson.url }`
}

/*parentPort.on('message', (opts, page, directory, lesson) => {
    try {
        const result = scraper(opts, page, directory, lesson);
        parentPort.postMessage(result);
    } catch (error) {
        parentPort.postMessage(`Error occurred with scraper: ${error.message}`);    }
});*/

// (async () => {
// })();

// module.exports = scraper
export default scraper
