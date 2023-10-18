import {Cluster} from "puppeteer-cluster";
import * as puppeteer from "puppeteer";
import { ScrapeOpts } from "../types.js";

export default class PuppeteerClusterHelper {
    opts: {
         headless: string | boolean;
         ignoreHTTPSErrors: boolean;
         waitUntil: string;
         defaultViewport: { width: number; height: number; };
         timeout: number;
         protocolTimeout: number;
         args: string[];
         executablePath: string | undefined;
    };

    cluster: any;
    constructor(opts: ScrapeOpts | undefined) {
        this.opts = {
            headless: opts?.headless === 'yes' ? 'new' : false,//false, //
            ignoreHTTPSErrors: true,
            waitUntil: 'networkidle2',
            defaultViewport: {
                width: 1920,
                height: 1080
            },
            timeout: 180000e3,
            protocolTimeout: 180000e3,
            args: [
                '--no-sandbox',
                '--start-maximized',

                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-xss-auditor',
                '--no-zygote',
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
        // this.cluster = null;
    }

    async withBrowser(fn: any) {//fn
        const clusterLaunchOptions = {
            concurrency      : Cluster.CONCURRENCY_PAGE, // single chrome multi tab mode
            maxConcurrency   : 7, // number of concurrent workers
            retrylimit       : 5, // number of retries
            skipduplicateurls: true, // do not crawl duplicate URLs
            // monitor: true, // displays the performance consumption
            puppeteerOptions: this.opts,
            timeout         : 3600e3,
        };
        this.cluster = await Cluster.launch(clusterLaunchOptions as any);
        this.cluster.on('taskerror', (err: { message: any; }, data: any, willRetry: any) => {
            if (willRetry) {
                console.warn(`Encountered an error while crawling ${data}. ${err.message}\nThis job will be retried`);
            } else {
                console.error(`Failed to crawl ${data}: ${err.message}`);
                console.error('---Data', data);
                console.error('---Errror', err);
            }

        });
        try {
            return await fn(this.cluster);
            // console.log('---0000111');
            // return this.cluster;
        } finally {
            // await this.cluster.idle();
            await this.cluster.close();
        }
    }

    async withPage(fn: any) {
        await this.cluster.task(async ({ page }: { page: puppeteer.Page }): Promise<void> => {
            await fn(page);
        });
    }
}

// module.exports = PuppeteerClusterHelper;

/*const PuppeteerClusterHelper = require('./PuppeteerClusterHelper');

(async () => {
    const puppeteerClusterHelper = new PuppeteerClusterHelper();

    await puppeteerClusterHelper.withBrowser(async cluster => {
        await cluster.task(async ({ page }) => {
            // Your code here
        });

        // Use the withPage method to run a function with a page
        await puppeteerClusterHelper.withPage(async page => {
            // Your code here
        });
    });
})();*/
