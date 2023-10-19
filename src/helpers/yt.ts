import * as path from "path";
// const logger = require("./logger.js");

import fs from "fs-extra";
import logger from "./logger.js";
import FileChecker from "./fileChecker.js";

// const YTDlpWrap = require('yt-dlp-wrap').default;
// import {YTDlpWrap} from 'yt-dlp-wrap';
// const ytDlpWrap = new YTDlpWrap();

// import YTDlpWrap from'./y.cjs';
import {BcDLP} from 'bc-dlp'

const ytDlpWrap = new BcDLP('yt-dlp')

async function retry(fn: any, retriesLeft = 5, interval = 1000, exponential = false) {
    try {
        const val = await fn();
        return val;
    } catch (error) {
        if (retriesLeft) {
            logger.warn('.... 22cluster retrying left (' + retriesLeft + ')');
            logger.warn('retrying err', error);
            await new Promise(r => setTimeout(r, interval));
            return retry(fn, retriesLeft - 1, exponential ? interval * 2 : interval, exponential);
        } else {
            logger.error('Max retries reached');
            throw error
            //throw new Error('Max retries reached');
        }
    }
}

/*exports.mpbDown = async (url: any, dest: any, cb: any) => {//
    return new Promise<void>((resolve, reject) => {
        ytDlpWrap
            .exec([
                url,
                "--write-subs",
                "--write-auto-sub",
                '--referer', 'https://fireship.io/',
                "-o", path.resolve(dest),
                '--socket-timeout', '5'
            ])
            .on("progress", cb)
            .on("error", (err: any) => reject(err))
            .on("close", () => resolve())
    });
};*/

export default async (
    url: string,
    dest: string,
    ms: any,
    index: string | number,
    localSizeInBytes: any,
    remoteSizeInBytes: any,
    logger: any,
    downFolder: any,
    resolve: (arg0: any) => void,
    reject: (arg0: any) => void) => {
    return await retry(async () => {//return
        // ytDlpWrap
        // (new YTDlpWrap())
        //     .exec([
        //         url,

        //         "--write-subs",
        //         "--write-auto-sub",

        //         '--referer', 'https://fireship.io/',
        //         "-o", path.resolve(dest),
        //         '--socket-timeout', '5'
        //     ])
        //     .on('ytDlpEvent', (eventType: any, eventData: any) =>
        //         // console.log(eventType, eventData)
        //         //65.0% of   24.60MiB at    6.14MiB/s ETA 00:01
        //         ms.update(dest, {text: `${eventType}: ${eventData} | ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`})
        //     )
        //     // .on("youtubeDlEvent", (eventType, eventData) => console.log(eventType, eventData))
        //     .on("error", (error: { message: string | string[]; }) => {
        //         // ms.remove(dest, { text: error })
        //         if (!error.message.includes('Unable to extract info section')) {
        //             logger.error('URL:', url, 'dest:', dest, 'error--', error)
        //         }
        //         /*fs.unlink(dest, (err) => {
        //             reject(error);
        //         });*/
        //         //return Promise.reject(error)
        //         reject(error);

        //     })
        //     .on("close", () => {
        //         // ms.succeed(dest, {text: `${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`})//.split('/').pop()
        //         // ms.remove(dest);
        //         // console.log(`${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`.green);
        //         // videoLogger.write(`${dest} Size:${getFilesizeInBytes(dest)}\n`);
        //         FileChecker.writeWithOutSize(downFolder, dest)
        //         resolve(dest)
        //     })

        ytDlpWrap
            .exec([
                url,
                "--write-subs",
                "--write-auto-sub",
                '--referer', 'https://cloudcasts.io/',
                "-o", path.resolve(dest),
                '--socket-timeout', '5'
            ])
            // .on('progress', (progress: any) =>
            //     console.log('progress::',
            //         progress.percent,
            //         progress.totalSize,
            //         progress.currentSpeed,
            //         progress.eta
            //     )
            // )
            .on('ytDlpEvent', (eventType: any, eventData: any) =>
                // console.log(eventType, eventData)
                //65.0% of   24.60MiB at    6.14MiB/s ETA 00:01
                ms.update(dest, {text: `${eventType}: ${eventData} | ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`})
            )
            .on("error", (error: { message: string | string[]; }) => {
                // ms.remove(dest, { text: error })
                if (!error.message.includes('Unable to extract info section')) {
                    logger.error('URL:', url, 'dest:', dest, 'error--', error);
                }
                /*fs.unlink(dest, (err) => {
                    reject(error);
                });*/
                //return Promise.reject(error)
                reject(error);
            })
            .on("close", () => {
                // ms.succeed(dest, {text: `${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`})//.split('/').pop()
                // ms.remove(dest);
                // console.log(`${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`.green);
                // videoLogger.write(`${dest} Size:${getFilesizeInBytes(dest)}\n`);
                FileChecker.writeWithOutSize(downFolder, dest);
                resolve(dest);
            });

    }, 6, 2e3, true);
}

// module.exports = ytdown;
// module.exports = {
//     ytdown,
//     mpbDown
// }
