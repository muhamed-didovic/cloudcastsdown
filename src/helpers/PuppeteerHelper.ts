import puppeteer from 'puppeteer-extra'
// import findChrome from "chrome-finder";
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import {ScrapeOpts} from "../types";
puppeteer.use(StealthPlugin())

export default class PuppeteerHelper {
    opts: {
        headless: string | boolean;
        ignoreHTTPSErrors: boolean;
        waitUntil: string;
        defaultViewport: { width: number; height: number; };
        timeout?: number;
        args: string[];
        executablePath: string | undefined;
    };
    constructor(opts: ScrapeOpts | undefined) {
        this.opts = {
            headless: opts?.headless === 'yes' ? 'new' : false,
            ignoreHTTPSErrors: true,
            waitUntil: 'networkidle2',
            defaultViewport: {
                width: 1920,
                height: 1080
            },
            timeout: 180000e3,
            protocolTimeout: 180000e3,
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-xss-auditor',
                '--no-zygote',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--allow-running-insecure-content',
                '--disable-webgl',
                '--disable-popup-blocking',
                '--enable-features=NetworkService',
                '--disable-features=IsolateOrigins,site-per-process'
            ],
            executablePath: puppeteer
                .executablePath()
                .match(/google-chrome/) != null
                ? puppeteer.executablePath()
                : undefined
        };
    }

    async withBrowser(fn: any) {
        const browser = await puppeteer.launch(this.opts);

        try {
            return await fn(browser);
        } finally {
            await browser.close();
        }
    }

    withPage(browser: any) {
        return async (fn: (arg0: any) => any) => {
            const page = await browser.newPage();
            try {
                return await fn(page);
            } finally {
                await page.close();
            }
        };
    }
}

/**
 *
 * @param fn
 * @returns {Promise<*>}
 */
/*async withBrowser(fn, opts) {
    const browser = await puppeteer.launch({
        // devtools: true,
        headless: opts.headless === 'yes' ? 'new' : false, //run false for dev memo
        Ignorehttpserrors: true, // ignore certificate error
        waitUntil        : 'networkidle2',
        defaultViewport  : {
            width : 1920,
            height: 1080
        },
        timeout          : 91e3,
        args             : [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '-- Disable XSS auditor', // close XSS auditor
            '--no-zygote',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '-- allow running secure content', // allow unsafe content
            '--disable-webgl',
            '--disable-popup-blocking',
            //'--proxy-server= http://127.0.0.1:8080 '// configure agent

            '--enable-features=NetworkService',
            '--disable-features=IsolateOrigins,site-per-process',
            // '--shm-size=3gb', // this solves the issue
        ],
        executablePath   : findChrome(),
    })

    try {
        return await fn(browser)
    } finally {
        await browser.close()
    }
}*/

/**
 *
 * @param browser
 * @returns {(function(*): Promise<*|undefined>)|*}
 */
/*withPage(browser) {
    return async fn => {
        const page = await browser.newPage()
        try {
            return await fn(page)
        } finally {
            await page.close()
        }
    }
}*/

// export default PuppeteerHelper;
